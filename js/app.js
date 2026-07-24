import { openDB, getAllItems, getAllMovements } from './db.js';
import { seedIfEmpty } from './catalog.js';
import { renderItemList } from './render.js';

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
  renderItemList(itemListEl, filtered);
}

searchInputEl.addEventListener('input', renderFilteredList);

async function bootstrap() {
  state.db = await openDB();
  await seedIfEmpty(state.db);
  await reloadState();
  renderFilteredList();
}

bootstrap();
