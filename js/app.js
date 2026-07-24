import { openDB, getAllItems, getAllMovements, addMovement, updateItem } from './db.js';
import { seedIfEmpty } from './catalog.js';
import { renderItemList } from './render.js';
import { applyMovement, getRefillList, checkoffRefill } from './inventory.js';
import { parseVoiceCommand } from './voiceParser.js';
import { showConfirmCard, showUndoBanner } from './confirmCard.js';
import { updateBadge } from './badge.js';

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

function renderFilteredList() {
  const query = searchInputEl.value.trim().toLowerCase();
  const filtered = query
    ? state.items.filter((item) => item.name.toLowerCase().includes(query))
    : state.items;
  renderItemList(itemListEl, filtered, { onStep: handleStep });
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
    checkbox.addEventListener('change', async () => {
      const { updatedItem, movement } = checkoffRefill(item);
      await updateItem(state.db, updatedItem);
      await addMovement(state.db, movement);
      await reloadState();
      renderFilteredList();
      renderRefillTab();
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

async function bootstrap() {
  state.db = await openDB();
  await seedIfEmpty(state.db);
  await reloadState();
  renderFilteredList();
  renderRefillTab();
}

bootstrap();
