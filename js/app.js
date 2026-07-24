import { openDB, getAllItems, getAllMovements, addMovement, updateItem } from './db.js';
import { seedIfEmpty } from './catalog.js';
import { renderItemList } from './render.js';
import { applyMovement } from './inventory.js';
import { parseVoiceCommand } from './voiceParser.js';
import { showConfirmCard, showUndoBanner } from './confirmCard.js';

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

async function commitMovement(item, delta, source) {
  const { updatedItem, movement } = applyMovement(item, delta, source);
  await updateItem(state.db, updatedItem);
  await addMovement(state.db, movement);
  await reloadState();
  renderFilteredList();

  showUndoBanner({
    message: `${item.name}: ${delta > 0 ? '+' : ''}${delta} ${item.unit}`,
    onUndo: async () => {
      const { updatedItem: reverted } = applyMovement(updatedItem, -delta, source);
      await updateItem(state.db, reverted);
      await reloadState();
      renderFilteredList();
    },
  });
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
}

bootstrap();
