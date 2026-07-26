import { openDB, getAllItems, getAllMovements, addMovement, updateItem, replaceAllData } from './db.js';
import { seedIfEmpty } from './catalog.js';
import { renderItemList } from './render.js';
import { applyMovement, getRefillList, checkoffRefill } from './inventory.js';
import { parseVoiceCommand } from './voiceParser.js';
import { showConfirmCard, showUndoBanner } from './confirmCard.js';
import { updateBadge } from './badge.js';
import { generateInventoryPdf } from './pdfExport.js';
import { serializeBackup, parseBackup } from './backup.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

export const state = { db: null, items: [], movements: [] };

export async function reloadState() {
  state.items = await getAllItems(state.db);
  state.movements = await getAllMovements(state.db);
}

const tabButtons = document.querySelectorAll('.tab-btn');
const views = {
  bestand: document.getElementById('view-bestand'),
  auffuellen: document.getElementById('view-auffuellen'),
  inventur: document.getElementById('view-inventur'),
  einstellungen: document.getElementById('view-einstellungen'),
};

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(views).forEach(([name, el]) => {
      el.classList.toggle('hidden', name !== btn.dataset.view);
    });
  });
});

const itemListEl = document.getElementById('item-list');
const searchInputEl = document.getElementById('search-input');
const historyModalEl = document.getElementById('item-history-modal');

function renderItemHistory(item) {
  const movements = state.movements
    .filter((m) => m.itemId === item.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  historyModalEl.innerHTML = '';
  historyModalEl.classList.remove('hidden');

  const title = document.createElement('h3');
  title.textContent = `Verlauf: ${item.name}`;
  historyModalEl.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'history-list';
  for (const movement of movements) {
    const li = document.createElement('li');
    const date = new Date(movement.timestamp).toLocaleString('de-DE');
    const sign = movement.delta > 0 ? '+' : '';
    li.textContent = `${date} — ${sign}${movement.delta} (${movement.source}) → ${movement.newQty}`;
    list.appendChild(li);
  }
  if (movements.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Noch keine Buchungen.';
    list.appendChild(li);
  }
  historyModalEl.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Schließen';
  closeBtn.addEventListener('click', () => historyModalEl.classList.add('hidden'));
  historyModalEl.appendChild(closeBtn);
}

function renderFilteredList() {
  const query = searchInputEl.value.trim().toLowerCase();
  const filtered = query
    ? state.items.filter((item) => item.name.toLowerCase().includes(query))
    : state.items;
  renderItemList(itemListEl, filtered, { onStep: handleStep, onItemClick: renderItemHistory });
}

searchInputEl.addEventListener('input', renderFilteredList);

const refillListEl = document.getElementById('refill-list');

function renderRefillTab() {
  const refillItems = getRefillList(state.items);
  refillListEl.innerHTML = '';

  for (const item of refillItems) {
    const row = document.createElement('label');
    row.className = 'item-card';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      // Disable synchronously so a rapid double-tap can't fire this handler
      // twice before the mutex-queued write even starts; the row gets rebuilt
      // by the next renderRefillTab() call regardless.
      checkbox.disabled = true;
      commitChain = commitChain
        .catch((err) => { console.error('Abhaken fehlgeschlagen:', err); })
        .then(() => doCheckoffRefill(item.id));
    });

    const label = document.createElement('span');
    label.textContent = `${item.icon} ${item.name} (${item.currentQty}/${item.targetQty} ${item.unit})`;

    row.append(checkbox, label);
    refillListEl.appendChild(row);
  }

  updateBadge(refillItems.length);
}

// Module-level async mutex: serializes all commit/undo DB work so rapid
// back-to-back calls (e.g. two quick stepper taps) never overlap. Each queued
// unit of work re-resolves "the current item" from state.items instead of
// trusting a possibly-stale closure-captured item object.
let commitChain = Promise.resolve();

function commitMovement(item, delta, source) {
  const itemId = item.id;
  // .catch((err) => { console.error(...) }) logs errors but still ensures one
  // failed commit doesn't permanently wedge the chain and block future commits/undos.
  commitChain = commitChain.catch((err) => { console.error('Buchung fehlgeschlagen:', err); }).then(() => doCommitMovement(itemId, item, delta, source));
  return commitChain;
}

async function doCommitMovement(itemId, fallbackItem, delta, source) {
  // Resolve the current item fresh at the moment this queued work actually
  // runs (after any earlier queued commit has fully persisted + reloaded),
  // rather than trusting the item captured by the button's original closure.
  const currentItem = state.items.find((i) => i.id === itemId) ?? fallbackItem;
  const priorQty = currentItem.currentQty;
  const { updatedItem, movement } = applyMovement(currentItem, delta, source);
  await updateItem(state.db, updatedItem);
  await addMovement(state.db, movement);
  await reloadState();
  renderFilteredList();
  renderRefillTab();

  showUndoBanner({
    message: `${currentItem.name}: ${delta > 0 ? '+' : ''}${delta} ${currentItem.unit}`,
    onUndo: () => {
      // Restore the exact pre-movement quantity rather than replaying -delta
      // through applyMovement's clamp (which would manufacture stock when the
      // original movement had been clamped at 0). Queued on the same mutex so
      // it can't race with an in-flight commit either.
      commitChain = commitChain
        .catch((err) => { console.error('Rückgängig fehlgeschlagen:', err); })
        .then(() => doUndoMovement(itemId, currentItem, priorQty, movement.newQty, source));
      return commitChain;
    },
  });
}

async function doUndoMovement(itemId, fallbackItem, priorQty, postQty, source) {
  const currentItem = state.items.find((i) => i.id === itemId) ?? fallbackItem;
  const updatedItem = { ...currentItem, currentQty: priorQty };
  const undoMovement = {
    itemId,
    delta: priorQty - postQty,
    newQty: priorQty,
    source,
    timestamp: new Date().toISOString(),
  };
  await updateItem(state.db, updatedItem);
  await addMovement(state.db, undoMovement);
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

async function doCheckoffRefill(itemId) {
  // Resolve the current item fresh at the moment this queued work actually
  // runs, rather than trusting the item captured by the checkbox's original
  // closure (which may be stale after a stepper commit or an earlier
  // checkoff has landed for this same item).
  const currentItem = state.items.find((i) => i.id === itemId);
  if (!currentItem) return;
  const { updatedItem, movement } = checkoffRefill(currentItem);
  await updateItem(state.db, updatedItem);
  await addMovement(state.db, movement);
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

async function doImportBackup(items, movements) {
  await replaceAllData(state.db, items, movements);
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

function handleStep(item, direction) {
  commitMovement(item, direction, 'manual');
}

const voiceInputEl = document.getElementById('voice-input');
const voiceSubmitBtn = document.getElementById('voice-submit-btn');

function handleVoiceSubmit() {
  const text = voiceInputEl.value.trim();
  if (!text) return;
  const { quantity, direction, matches } = parseVoiceCommand(text, state.items);

  showConfirmCard({
    item: matches.length === 1 ? matches[0] : null,
    quantity: quantity ?? 1,
    direction,
    matches,
    onConfirm: (selectedItem, finalQuantity, finalDirection) => {
      if (!selectedItem) return;
      const delta = finalDirection === 'add' ? finalQuantity : -finalQuantity;
      commitMovement(selectedItem, delta, 'voice');
      voiceInputEl.value = '';
    },
    onCancel: () => {
      voiceInputEl.value = '';
    },
  });
}

voiceSubmitBtn.addEventListener('click', handleVoiceSubmit);
voiceInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleVoiceSubmit();
});

const inventurYearSelect = document.getElementById('inventur-year');
const exportPdfBtn = document.getElementById('export-pdf-btn');

function populateYearSelect() {
  const currentYear = new Date().getFullYear();
  inventurYearSelect.innerHTML = '';
  for (let year = currentYear; year >= currentYear - 5; year--) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    inventurYearSelect.appendChild(option);
  }
}

exportPdfBtn.addEventListener('click', () => {
  const year = parseInt(inventurYearSelect.value, 10);
  const doc = generateInventoryPdf(state.items, state.movements, year);
  doc.save(`Jahresinventur-${year}.pdf`);
});

const backupExportBtn = document.getElementById('backup-export-btn');
const backupImportBtn = document.getElementById('backup-import-btn');
const backupImportInput = document.getElementById('backup-import-input');

backupExportBtn.addEventListener('click', () => {
  const json = serializeBackup(state.items, state.movements);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auto-bestand-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

backupImportBtn.addEventListener('click', () => backupImportInput.click());

backupImportInput.addEventListener('change', async () => {
  const file = backupImportInput.files[0];
  if (!file) return;
  const text = await file.text();
  let parsedBackup;
  try {
    parsedBackup = parseBackup(text);
  } catch (err) {
    alert(err.message);
    backupImportInput.value = '';
    return;
  }
  const { items, movements } = parsedBackup;
  // Queued onto the same commitChain mutex as commit/undo/checkoff so an
  // import can't race with an in-flight write. The leading .catch() logs (but
  // doesn't rethrow) any earlier queued failure so it can't wedge this import;
  // the trailing .catch() covers a failure of this import's own write and,
  // per convention, is reported via console.error rather than a user-facing
  // alert (only the synchronous parse failure above alerts the user).
  commitChain = commitChain
    .catch((err) => { console.error('Import fehlgeschlagen:', err); })
    .then(() => doImportBackup(items, movements))
    .then(() => { alert('Backup erfolgreich importiert.'); })
    .catch((err) => { console.error('Import fehlgeschlagen:', err); });
  backupImportInput.value = '';
});

async function bootstrap() {
  state.db = await openDB();
  await seedIfEmpty(state.db);
  await reloadState();
  renderFilteredList();
  renderRefillTab();
  populateYearSelect();
}

bootstrap();
