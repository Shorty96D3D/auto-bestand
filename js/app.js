import { openDB, getAllItems, getAllMovements, addMovement, addItem, updateItem, deleteItem, replaceAllData } from './db.js';
import { seedIfEmpty } from './catalog.js';
import { renderItemList } from './render.js';
import { applyMovement, getRefillList, checkoffRefill } from './inventory.js';
import { parseVoiceCommand } from './voiceParser.js';
import { showConfirmCard, showUndoBanner, hideUndoBanner } from './confirmCard.js';
import { updateBadge } from './badge.js';
import { generateInventoryPdf } from './pdfExport.js';
import { serializeBackup, parseBackup } from './backup.js';
import { parseItemForm } from './itemForm.js';
import { showItemFormModal } from './itemFormModal.js';

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

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = 'Bearbeiten';
  editBtn.addEventListener('click', () => {
    historyModalEl.classList.add('hidden');
    showItemFormModal({
      mode: 'edit',
      item,
      onSubmit: (rawFields) => {
        commitChain = commitChain.catch((err) => { console.error('Bearbeiten fehlgeschlagen:', err); }).then(() => doUpdateItem(item.id, rawFields));
      },
      onCancel: () => {},
    });
  });
  historyModalEl.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Löschen';
  deleteBtn.className = 'secondary';
  deleteBtn.addEventListener('click', () => {
    if (!confirm(`"${item.name}" wirklich löschen?`)) return;
    historyModalEl.classList.add('hidden');
    commitChain = commitChain.catch((err) => { console.error('Löschen fehlgeschlagen:', err); }).then(() => doDeleteItem(item.id));
  });
  historyModalEl.appendChild(deleteBtn);

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

const addItemBtn = document.getElementById('add-item-btn');
addItemBtn.addEventListener('click', () => {
  showItemFormModal({
    mode: 'add',
    onSubmit: (rawFields) => {
      commitChain = commitChain.catch((err) => { console.error('Hinzufügen fehlgeschlagen:', err); }).then(() => doAddItem(rawFields));
    },
    onCancel: () => {},
  });
});

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
        .then(() => doCheckoffRefill(item.id))
        .catch((err) => {
          // Re-render on failure too, otherwise the row keeps the checkbox that
          // was disabled synchronously above and the item can never be checked
          // off again without a reload.
          console.error('Abhaken fehlgeschlagen:', err);
          renderFilteredList();
          renderRefillTab();
        });
    });

    const label = document.createElement('span');
    label.textContent = `${item.icon} ${item.name} (${item.currentQty}/${item.targetQty} ${item.unit})`;

    row.append(checkbox, label);
    refillListEl.appendChild(row);
  }

  // Feature detection inside updateBadge covers "unsupported"; a rejected
  // promise (e.g. permission denied) still needs catching here.
  updateBadge(refillItems.length).catch(() => {});
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
    // movement.delta is the *effective* change (clamped at 0 stock), so the
    // banner never claims more was booked than actually was.
    message: `${currentItem.name}: ${movement.delta > 0 ? '+' : ''}${movement.delta} ${currentItem.unit}`,
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
  // A banner left over from an earlier commit refers to a state this checkoff
  // is about to invalidate; tapping it afterwards would replay stale undo data
  // against the new quantity. Kill it before touching anything.
  hideUndoBanner();
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
  // Same reasoning as doCheckoffRefill: an import replaces every record, so any
  // pending undo from before the import is meaningless and must not stay tappable.
  hideUndoBanner();
  await replaceAllData(state.db, items, movements);
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

async function doAddItem(rawFields) {
  // Same reasoning as doCheckoffRefill/doImportBackup: this mutation invalidates
  // any stale undo banner referring to a pre-existing item/quantity.
  hideUndoBanner();
  let parsed;
  try {
    parsed = parseItemForm(rawFields);
  } catch (err) {
    alert(err.message);
    return;
  }
  await addItem(state.db, { ...parsed, currentQty: parsed.targetQty });
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

async function doUpdateItem(itemId, rawFields) {
  hideUndoBanner();
  // Resolve the current item fresh at the moment this queued work actually
  // runs, same convention as doCommitMovement/doCheckoffRefill.
  const current = state.items.find((i) => i.id === itemId);
  if (!current) return;
  let parsed;
  try {
    parsed = parseItemForm(rawFields);
  } catch (err) {
    alert(err.message);
    return;
  }
  await updateItem(state.db, { ...current, ...parsed });
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

async function doDeleteItem(itemId) {
  hideUndoBanner();
  await deleteItem(state.db, itemId);
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
    // Only used when nothing matched: the card then offers the whole catalog
    // for manual selection instead of dead-ending.
    allItems: state.items,
    onConfirm: (selectedItem, finalQuantity, finalDirection) => {
      voiceInputEl.value = '';
      if (!selectedItem) return;
      const delta = finalDirection === 'add' ? finalQuantity : -finalQuantity;
      commitMovement(selectedItem, delta, 'voice');
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

// Populated at module scope (it only needs the clock, not the database), so an
// export tapped during the initial seed/load window can't read an empty select
// and produce "Jahresinventur-NaN.pdf".
populateYearSelect();

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
  // Import is the only irreversible, fully destructive action in the app and
  // parseBackup only checks the coarse shape, so a structurally valid but wrong
  // file would silently wipe everything. Ask first.
  if (!confirm('Bestand wird überschrieben — fortfahren?')) {
    backupImportInput.value = '';
    return;
  }
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
}

bootstrap();
