# Auto-Bestand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only iOS PWA that lets an electrician track van/car stock, book removals/refills via iPhone dictation, see a checkable refill list, and export a year-end inventory PDF.

**Architecture:** Static HTML/CSS/JS PWA, no bundler, no framework. Pure business-logic modules (inventory math, voice parsing, PDF row-building, backup serialization) are unit-tested with Node's built-in test runner. DOM/IndexedDB/PDF-rendering glue modules are thin wrappers verified manually in-browser. Data lives only in IndexedDB on-device; app code is the only thing hosted on GitHub Pages.

**Tech Stack:** Vanilla JS (ES modules), IndexedDB, vendored jsPDF (UMD), Web Badging API, Service Worker. Dev-only: Node.js `node:test` + `fake-indexeddb` (never shipped to the browser).

## Global Constraints

- No build step, no bundler, no frontend framework for the shipped app — plain `<script type="module">` files only.
- No CDN runtime dependencies — jsPDF is vendored as a local file in `vendor/`.
- All application data (items, movements) lives only in IndexedDB on the device. No server calls, no accounts, no sync.
- Exactly one inventory (single vehicle) — no multi-vehicle data model.
- UI language: German throughout (labels, button text, error messages).
- Accent color: Apple System Purple — light mode `#AF52DE`, dark mode `#BF5AF2`. Respect `prefers-color-scheme` for full dark mode.
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`.
- Any voice-parsed booking MUST go through the confirmation card — never auto-commit silently.
- Checking off a refill-list item MUST set `currentQty` to that item's `targetQty` (not just hide it).
- Inventory PDF export MUST produce two separate pages/sheets: stock list, then stats.
- Icon badge uses the Badging API with feature detection — silently no-ops where unsupported (no error, no fallback UI needed).
- Dev-only test tooling (`package.json`, `node_modules`, `fake-indexeddb`) must never be referenced by `index.html` or any shipped file.
- Final deployment target: a **private** GitHub repository with GitHub Pages enabled, pushed directly (user has pre-authorized this specific push).

## File Structure

```
index.html
manifest.json
service-worker.js
css/styles.css
js/db.js
js/catalog.js
js/inventory.js
js/voiceParser.js
js/badge.js
js/pdfData.js
js/pdfExport.js
js/backup.js
js/app.js
vendor/jspdf.umd.min.js
icons/icon-192.png
icons/icon-512.png
tests/inventory.test.js
tests/voiceParser.test.js
tests/catalog.test.js
tests/pdfData.test.js
tests/backup.test.js
tests/badge.test.js
tests/db.test.js
package.json
```

---

### Task 1: PWA Scaffold (HTML shell, manifest, CSS design tokens, service worker registration)

**Files:**
- Create: `index.html`
- Create: `manifest.json`
- Create: `css/styles.css`
- Create: `service-worker.js`
- Create: `js/app.js` (stub — real wiring lands in Task 6)
- Create: `icons/icon-192.png`, `icons/icon-512.png`

**Interfaces:**
- Produces: the DOM element IDs every later UI task binds to: `#page-title`, `#view-bestand`, `#view-auffuellen`, `#view-inventur`, `#view-einstellungen`, `#search-input`, `#voice-input`, `#voice-submit-btn`, `#item-list`, `#refill-list`, `#inventur-year`, `#export-pdf-btn`, `#backup-export-btn`, `#backup-import-btn`, `#backup-import-input`, `#confirm-card`, `#undo-banner`, `#item-history-modal`, `.tab-btn[data-view]` nav buttons.
- Produces: CSS custom properties `--accent`, `--bg`, `--bg-elevated`, `--text`, `--text-secondary`, `--divider`, `--status-ok`, `--status-low` (light + dark via `prefers-color-scheme`).

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#AF52DE">
  <title>Auto-Bestand</title>
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="app-header">
    <h1 id="page-title">Bestand</h1>
  </header>

  <main id="view-bestand" class="view">
    <div class="search-bar">
      <input type="search" id="search-input" placeholder="Artikel suchen">
    </div>
    <div id="voice-booking" class="voice-booking">
      <input type="text" id="voice-input" placeholder="z. B. „zwei Wago-Klemmen entnommen“" autocomplete="off">
      <button id="voice-submit-btn" type="button">Buchen</button>
    </div>
    <div id="item-list"></div>
  </main>

  <main id="view-auffuellen" class="view hidden">
    <div id="refill-list"></div>
  </main>

  <main id="view-inventur" class="view hidden">
    <label for="inventur-year">Jahr</label>
    <select id="inventur-year"></select>
    <button id="export-pdf-btn" type="button">Jahresinventur exportieren</button>
  </main>

  <main id="view-einstellungen" class="view hidden">
    <button id="backup-export-btn" type="button">Backup exportieren</button>
    <button id="backup-import-btn" type="button">Backup importieren</button>
    <input type="file" id="backup-import-input" accept="application/json" class="hidden">
  </main>

  <div id="confirm-card" class="overlay hidden" role="dialog" aria-modal="true"></div>
  <div id="undo-banner" class="banner hidden" role="status"></div>
  <div id="item-history-modal" class="overlay hidden" role="dialog" aria-modal="true"></div>

  <nav class="tab-bar">
    <button class="tab-btn active" data-view="bestand" type="button">Bestand</button>
    <button class="tab-btn" data-view="auffuellen" type="button">Auffüllen</button>
    <button class="tab-btn" data-view="inventur" type="button">Inventur</button>
    <button class="tab-btn" data-view="einstellungen" type="button">Einstellungen</button>
  </nav>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "name": "Auto-Bestand",
  "short_name": "Auto-Bestand",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#F2F2F7",
  "theme_color": "#AF52DE",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Add two placeholder PNG icons**

Generate two solid-purple square PNGs (192×192 and 512×512) with a simple wrench/plug glyph, save as `icons/icon-192.png` and `icons/icon-512.png`. (Any quick script/tool is fine — these are placeholders the user can swap later; they just need to exist and be valid PNGs so the manifest and Apple touch icon resolve.)

- [ ] **Step 4: Create `css/styles.css` with design tokens, dark mode, and view/tab-bar layout**

```css
:root {
  --accent: #AF52DE;
  --bg: #F2F2F7;
  --bg-elevated: #FFFFFF;
  --text: #1C1C1E;
  --text-secondary: #6C6C70;
  --divider: #D1D1D6;
  --status-ok: #34C759;
  --status-low: #FF9500;
}

@media (prefers-color-scheme: dark) {
  :root {
    --accent: #BF5AF2;
    --bg: #000000;
    --bg-elevated: #1C1C1E;
    --text: #FFFFFF;
    --text-secondary: #8E8E93;
    --divider: #38383A;
    --status-ok: #30D158;
    --status-low: #FF9F0A;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  padding-bottom: 72px; /* space for fixed tab bar */
}

.app-header {
  padding: 16px;
}

.app-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.view { padding: 0 16px; }
.view.hidden { display: none; }

.search-bar input,
.voice-booking input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 16px;
  margin-bottom: 10px;
}

.voice-booking { display: flex; gap: 8px; }
.voice-booking input { flex: 1; }

button {
  font-family: inherit;
  font-size: 16px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #FFFFFF;
  padding: 10px 16px;
  cursor: pointer;
}

.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--bg-elevated);
  border-top: 1px solid var(--divider);
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
}

.tab-btn {
  flex: 1;
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px;
}

.tab-btn.active { color: var(--accent); font-weight: 600; }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.overlay.hidden { display: none; }

.banner {
  position: fixed;
  bottom: 80px;
  left: 16px;
  right: 16px;
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 50;
}

.banner.hidden { display: none; }

.category-group {
  margin-bottom: 20px;
}

.category-group h2 {
  font-size: 13px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0 0 6px 4px;
}

.item-card {
  background: var(--bg-elevated);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.ok { background: var(--status-ok); }
.status-dot.low { background: var(--status-low); }
```

- [ ] **Step 5: Create a minimal `service-worker.js` (registration-only stub, full caching lands in Task 12)**

```js
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

- [ ] **Step 6: Create a stub `js/app.js` that registers the service worker and wires tab navigation**

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
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
```

- [ ] **Step 7: Manually verify in-browser**

Serve the project root with any static file server (e.g. `npx serve .`), open the URL in a desktop browser, confirm:
- Page loads with title "Bestand", purple accent visible on the "Buchen" button and active tab.
- Tapping each of the 4 tab bar buttons switches the visible view.
- Toggling OS/browser dark mode switches the color scheme.
- DevTools → Application → Service Workers shows the worker registered.

- [ ] **Step 8: Commit**

```bash
git add index.html manifest.json css/styles.css service-worker.js js/app.js icons/
git commit -m "Add PWA shell with tab navigation and Apple-style design tokens"
```

---

### Task 2: IndexedDB Persistence Layer

**Files:**
- Create: `js/db.js`
- Create: `tests/db.test.js`
- Create: `package.json`

**Interfaces:**
- Produces (used by Tasks 3, 6, 7, 8, 9, 11):
  - `openDB(): Promise<IDBDatabase>`
  - `getAllItems(db): Promise<Item[]>`
  - `addItem(db, item): Promise<number>` — `item` has no `id`; resolves with the new id
  - `updateItem(db, item): Promise<void>` — `item` includes `id`
  - `deleteItem(db, id): Promise<void>`
  - `addMovement(db, movement): Promise<number>` — `movement` has no `id`
  - `getAllMovements(db): Promise<Movement[]>`
  - `getMovementsForItem(db, itemId): Promise<Movement[]>`
  - `replaceAllData(db, items, movements): Promise<void>` — wipes and rewrites both stores (used by backup import)
- `Item` shape: `{ id, name, category, icon, unit, currentQty, targetQty, minQty, aliases: string[] }`
- `Movement` shape: `{ id, itemId, delta, newQty, source: 'voice'|'manual'|'checkoff'|'import', timestamp: string }`

This task is dev-tooling-only for testing: `package.json` and `fake-indexeddb` are never referenced by `index.html`.

- [ ] **Step 1: Create `package.json` (dev-only, not shipped to the browser)**

```json
{
  "name": "auto-bestand-dev-tools",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.1"
  }
}
```

- [ ] **Step 2: Install dev dependency**

Run: `npm install`
Expected: `node_modules/fake-indexeddb` present, `package-lock.json` created.

- [ ] **Step 3: Write the failing test for `openDB` + basic item CRUD**

```js
// tests/db.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { openDB, getAllItems, addItem, updateItem, deleteItem } from '../js/db.js';

test('addItem then getAllItems returns the stored item with an id', async () => {
  const db = await openDB();
  const newId = await addItem(db, {
    name: 'Testartikel', category: 'Test', icon: '🔧', unit: 'Stück',
    currentQty: 5, targetQty: 10, minQty: 2, aliases: ['testartikel'],
  });
  const items = await getAllItems(db);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, newId);
  assert.equal(items[0].name, 'Testartikel');
});

test('updateItem persists changed fields', async () => {
  const db = await openDB();
  await addItem(db, {
    name: 'A', category: 'C', icon: '🔧', unit: 'Stück',
    currentQty: 5, targetQty: 10, minQty: 2, aliases: ['a'],
  });
  const [item] = await getAllItems(db);
  await updateItem(db, { ...item, currentQty: 3 });
  const [updated] = await getAllItems(db);
  assert.equal(updated.currentQty, 3);
});

test('deleteItem removes the item', async () => {
  const db = await openDB();
  const id = await addItem(db, {
    name: 'B', category: 'C', icon: '🔧', unit: 'Stück',
    currentQty: 1, targetQty: 1, minQty: 0, aliases: ['b'],
  });
  await deleteItem(db, id);
  const items = await getAllItems(db);
  assert.equal(items.find((i) => i.id === id), undefined);
});
```

Note: each test file run shares one in-memory fake IndexedDB per `fake-indexeddb/auto` import — that's fine here since each test creates its own uniquely-named items and only asserts on what it created.

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/db.js` does not exist yet (`Cannot find module '../js/db.js'`).

- [ ] **Step 5: Implement `js/db.js`**

```js
const DB_NAME = 'autoBestandDB';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('movements')) {
        db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllItems(db) {
  return requestToPromise(getStore(db, 'items', 'readonly').getAll());
}

export async function addItem(db, item) {
  return requestToPromise(getStore(db, 'items', 'readwrite').add(item));
}

export async function updateItem(db, item) {
  await requestToPromise(getStore(db, 'items', 'readwrite').put(item));
}

export async function deleteItem(db, id) {
  await requestToPromise(getStore(db, 'items', 'readwrite').delete(id));
}

export async function addMovement(db, movement) {
  return requestToPromise(getStore(db, 'movements', 'readwrite').add(movement));
}

export async function getAllMovements(db) {
  return requestToPromise(getStore(db, 'movements', 'readonly').getAll());
}

export async function getMovementsForItem(db, itemId) {
  const all = await getAllMovements(db);
  return all.filter((m) => m.itemId === itemId);
}

export async function replaceAllData(db, items, movements) {
  const tx = db.transaction(['items', 'movements'], 'readwrite');
  const itemsStore = tx.objectStore('items');
  const movementsStore = tx.objectStore('movements');
  await requestToPromise(itemsStore.clear());
  await requestToPromise(movementsStore.clear());
  for (const item of items) await requestToPromise(itemsStore.put(item));
  for (const movement of movements) await requestToPromise(movementsStore.put(movement));
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 3 tests passing.

- [ ] **Step 7: Add a `.gitignore` for dev tooling**

```
node_modules/
package-lock.json
```

- [ ] **Step 8: Commit**

```bash
git add js/db.js tests/db.test.js package.json .gitignore
git commit -m "Add IndexedDB persistence layer with dev-only test suite"
```

---

### Task 3: Starter Catalog + Auto-Seed

**Files:**
- Create: `js/catalog.js`
- Create: `tests/catalog.test.js`

**Interfaces:**
- Consumes: `getAllItems(db)`, `addItem(db, item)` from `js/db.js` (Task 2)
- Produces (used by Task 6 app bootstrap): `STARTER_CATALOG: Array<Omit<Item, 'id'>>`, `seedIfEmpty(db): Promise<void>`

- [ ] **Step 1: Write the failing test**

```js
// tests/catalog.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { openDB, getAllItems } from '../js/db.js';
import { STARTER_CATALOG, seedIfEmpty } from '../js/catalog.js';

test('seedIfEmpty populates the starter catalog into an empty db', async () => {
  const db = await openDB();
  await seedIfEmpty(db);
  const items = await getAllItems(db);
  assert.equal(items.length, STARTER_CATALOG.length);
  assert.ok(items.every((i) => typeof i.id === 'number'));
});

test('seedIfEmpty does nothing if items already exist', async () => {
  const db = await openDB();
  await seedIfEmpty(db);
  await seedIfEmpty(db);
  const items = await getAllItems(db);
  assert.equal(items.length, STARTER_CATALOG.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/catalog.js` does not exist.

- [ ] **Step 3: Implement `js/catalog.js`**

```js
export const STARTER_CATALOG = [
  { name: 'NYM-J 3x1,5', category: 'Kabel & Leitungen', icon: '🔌', unit: 'Meter', currentQty: 50, targetQty: 50, minQty: 15, aliases: ['nym 3x1,5', 'kabel 3x1,5'] },
  { name: 'NYM-J 5x2,5', category: 'Kabel & Leitungen', icon: '🔌', unit: 'Meter', currentQty: 30, targetQty: 30, minQty: 10, aliases: ['nym 5x2,5', 'kabel 5x2,5'] },
  { name: 'Aderendhülsen', category: 'Kabel & Leitungen', icon: '🔌', unit: 'Stück', currentQty: 200, targetQty: 200, minQty: 50, aliases: ['aderendhülse', 'aderendhülsen', 'endhülsen'] },

  { name: 'Wago-Klemme', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 40, targetQty: 40, minQty: 10, aliases: ['wago', 'wagoklemme', 'wago klemme', 'klemme'] },
  { name: 'Abzweigdose', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 15, targetQty: 15, minQty: 5, aliases: ['abzweigdose', 'abzweigdosen'] },
  { name: 'Steckdose', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 20, targetQty: 20, minQty: 5, aliases: ['steckdose', 'steckdosen'] },
  { name: 'Schalter', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 20, targetQty: 20, minQty: 5, aliases: ['schalter'] },

  { name: 'LS-Schalter B16', category: 'Sicherungstechnik', icon: '⚡', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['ls schalter b16', 'leitungsschutzschalter b16', 'b16'] },
  { name: 'FI-Schutzschalter', category: 'Sicherungstechnik', icon: '⚡', unit: 'Stück', currentQty: 5, targetQty: 5, minQty: 2, aliases: ['fi schalter', 'fi schutzschalter', 'fehlerstromschutzschalter'] },
  { name: 'Feinsicherung', category: 'Sicherungstechnik', icon: '⚡', unit: 'Stück', currentQty: 20, targetQty: 20, minQty: 5, aliases: ['feinsicherung', 'feinsicherungen'] },

  { name: 'Isolierband', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['isolierband'] },
  { name: 'Kabelbinder', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 100, targetQty: 100, minQty: 20, aliases: ['kabelbinder'] },
  { name: 'Schrumpfschlauch', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 50, targetQty: 50, minQty: 10, aliases: ['schrumpfschlauch'] },
  { name: 'Dübel & Schrauben', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 100, targetQty: 100, minQty: 20, aliases: ['dübel', 'schrauben', 'dübel und schrauben'] },

  { name: 'LED-Lampe E27', category: 'Beleuchtung/Leuchtmittel', icon: '💡', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['led e27', 'led lampe', 'glühbirne', 'lampe'] },
  { name: 'LED-Lampe GU10', category: 'Beleuchtung/Leuchtmittel', icon: '💡', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['led gu10', 'gu10'] },
  { name: 'Notlicht-Akku', category: 'Beleuchtung/Leuchtmittel', icon: '💡', unit: 'Stück', currentQty: 5, targetQty: 5, minQty: 2, aliases: ['notlicht akku', 'notlichtakku'] },

  { name: 'Isolierhandschuhe', category: 'Arbeitsschutz (PSA)', icon: '🦺', unit: 'Paar', currentQty: 3, targetQty: 3, minQty: 1, aliases: ['isolierhandschuhe', 'handschuhe'] },
  { name: 'Schutzbrille', category: 'Arbeitsschutz (PSA)', icon: '🦺', unit: 'Stück', currentQty: 2, targetQty: 2, minQty: 1, aliases: ['schutzbrille'] },
  { name: 'Warnweste', category: 'Arbeitsschutz (PSA)', icon: '🦺', unit: 'Stück', currentQty: 2, targetQty: 2, minQty: 1, aliases: ['warnweste'] },

  { name: 'Batterien Multimeter', category: 'Mess-/Kleinzubehör', icon: '🔋', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 4, aliases: ['batterien', 'batterie multimeter'] },
  { name: 'Prüfspitzen', category: 'Mess-/Kleinzubehör', icon: '🔋', unit: 'Set', currentQty: 2, targetQty: 2, minQty: 1, aliases: ['prüfspitzen', 'pruefspitzen'] },
];

export async function seedIfEmpty(db) {
  const { getAllItems, addItem } = await import('./db.js');
  const existing = await getAllItems(db);
  if (existing.length > 0) return;
  for (const item of STARTER_CATALOG) {
    await addItem(db, item);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/catalog.js tests/catalog.test.js
git commit -m "Add electrician starter catalog with auto-seed"
```

---

### Task 4: Inventory Core Logic (pure business rules)

**Files:**
- Create: `js/inventory.js`
- Create: `tests/inventory.test.js`

**Interfaces:**
- Consumes: `Item` and `Movement` shapes from Task 2 (no DB access — pure functions only, takes/returns plain objects)
- Produces (used by Tasks 6, 7, 8, 9, 10):
  - `getStatus(item): 'ok' | 'low'`
  - `applyMovement(item, delta, source, now = new Date()): { updatedItem: Item, movement: Omit<Movement,'id'> }`
  - `checkoffRefill(item, now = new Date()): { updatedItem: Item, movement: Omit<Movement,'id'> }`
  - `getRefillList(items: Item[]): Item[]` — sorted by category then name
  - `computeYearStats(movements: Movement[], items: Item[], year: number): Array<{ itemId, name, category, removals: number, additions: number, totalRemovedQty: number }>`

- [ ] **Step 1: Write the failing tests**

```js
// tests/inventory.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatus, applyMovement, checkoffRefill, getRefillList, computeYearStats } from '../js/inventory.js';

const baseItem = { id: 1, name: 'Wago-Klemme', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 12, targetQty: 40, minQty: 10, aliases: ['wago'] };

test('getStatus returns ok when currentQty is above minQty', () => {
  assert.equal(getStatus(baseItem), 'ok');
});

test('getStatus returns low when currentQty is at or below minQty', () => {
  assert.equal(getStatus({ ...baseItem, currentQty: 10 }), 'low');
  assert.equal(getStatus({ ...baseItem, currentQty: 3 }), 'low');
});

test('applyMovement with negative delta reduces currentQty and records the movement', () => {
  const now = new Date('2026-03-01T10:00:00Z');
  const { updatedItem, movement } = applyMovement(baseItem, -2, 'voice', now);
  assert.equal(updatedItem.currentQty, 10);
  assert.equal(movement.itemId, 1);
  assert.equal(movement.delta, -2);
  assert.equal(movement.newQty, 10);
  assert.equal(movement.source, 'voice');
  assert.equal(movement.timestamp, now.toISOString());
});

test('applyMovement clamps currentQty at 0', () => {
  const { updatedItem } = applyMovement(baseItem, -999, 'manual');
  assert.equal(updatedItem.currentQty, 0);
});

test('checkoffRefill sets currentQty to targetQty and records a checkoff movement', () => {
  const low = { ...baseItem, currentQty: 4 };
  const { updatedItem, movement } = checkoffRefill(low, new Date('2026-03-02T00:00:00Z'));
  assert.equal(updatedItem.currentQty, 40);
  assert.equal(movement.delta, 36);
  assert.equal(movement.source, 'checkoff');
});

test('getRefillList only returns low-status items, sorted by category then name', () => {
  const items = [
    { ...baseItem, id: 1, name: 'Z-Artikel', category: 'B', currentQty: 20, minQty: 5 },
    { ...baseItem, id: 2, name: 'A-Artikel', category: 'A', currentQty: 1, minQty: 5 },
    { ...baseItem, id: 3, name: 'B-Artikel', category: 'A', currentQty: 1, minQty: 5 },
  ];
  const result = getRefillList(items);
  assert.deepEqual(result.map((i) => i.id), [2, 3]);
});

test('computeYearStats aggregates removals and additions per item within the given year', () => {
  const items = [baseItem];
  const movements = [
    { id: 1, itemId: 1, delta: -3, newQty: 9, source: 'voice', timestamp: '2026-01-15T00:00:00Z' },
    { id: 2, itemId: 1, delta: -2, newQty: 7, source: 'manual', timestamp: '2026-06-01T00:00:00Z' },
    { id: 3, itemId: 1, delta: 33, newQty: 40, source: 'checkoff', timestamp: '2026-06-02T00:00:00Z' },
    { id: 4, itemId: 1, delta: -1, newQty: 39, source: 'voice', timestamp: '2025-12-31T00:00:00Z' },
  ];
  const stats = computeYearStats(movements, items, 2026);
  assert.equal(stats.length, 1);
  assert.equal(stats[0].itemId, 1);
  assert.equal(stats[0].removals, 2);
  assert.equal(stats[0].additions, 1);
  assert.equal(stats[0].totalRemovedQty, 5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/inventory.js` does not exist.

- [ ] **Step 3: Implement `js/inventory.js`**

```js
export function getStatus(item) {
  return item.currentQty <= item.minQty ? 'low' : 'ok';
}

export function applyMovement(item, delta, source, now = new Date()) {
  const newQty = Math.max(0, item.currentQty + delta);
  const updatedItem = { ...item, currentQty: newQty };
  const movement = { itemId: item.id, delta, newQty, source, timestamp: now.toISOString() };
  return { updatedItem, movement };
}

export function checkoffRefill(item, now = new Date()) {
  const delta = item.targetQty - item.currentQty;
  return applyMovement(item, delta, 'checkoff', now);
}

export function getRefillList(items) {
  return items
    .filter((item) => getStatus(item) === 'low')
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export function computeYearStats(movements, items, year) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const statsByItemId = new Map();

  for (const movement of movements) {
    const movementYear = new Date(movement.timestamp).getUTCFullYear();
    if (movementYear !== year) continue;
    const item = itemsById.get(movement.itemId);
    if (!item) continue;

    if (!statsByItemId.has(item.id)) {
      statsByItemId.set(item.id, { itemId: item.id, name: item.name, category: item.category, removals: 0, additions: 0, totalRemovedQty: 0 });
    }
    const stat = statsByItemId.get(item.id);
    if (movement.delta < 0) {
      stat.removals += 1;
      stat.totalRemovedQty += Math.abs(movement.delta);
    } else if (movement.delta > 0) {
      stat.additions += 1;
    }
  }

  return Array.from(statsByItemId.values());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/inventory.js tests/inventory.test.js
git commit -m "Add pure inventory business logic (status, movements, refill list, year stats)"
```

---

### Task 5: German Voice Command Parser (pure)

**Files:**
- Create: `js/voiceParser.js`
- Create: `tests/voiceParser.test.js`

**Interfaces:**
- Consumes: `Item[]` (uses `item.aliases`, `item.id`, `item.name`)
- Produces (used by Task 7): `parseVoiceCommand(text: string, items: Item[]): { quantity: number|null, direction: 'add'|'remove', matches: Item[], rawText: string }`

- [ ] **Step 1: Write the failing tests**

```js
// tests/voiceParser.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../js/voiceParser.js';

const items = [
  { id: 1, name: 'Wago-Klemme', category: 'Installationsmaterial', aliases: ['wago', 'wagoklemme', 'wago klemme', 'klemme'] },
  { id: 2, name: 'LED-Lampe E27', category: 'Beleuchtung/Leuchtmittel', aliases: ['led e27', 'led lampe', 'glühbirne', 'lampe'] },
];

test('parses digit quantity, matched alias, and removal verb', () => {
  const result = parseVoiceCommand('2 Wago-Klemmen entnommen', items);
  assert.equal(result.quantity, 2);
  assert.equal(result.direction, 'remove');
  assert.deepEqual(result.matches.map((i) => i.id), [1]);
});

test('parses German number word quantity', () => {
  const result = parseVoiceCommand('zwei Glühbirnen entnommen', items);
  assert.equal(result.quantity, 2);
  assert.deepEqual(result.matches.map((i) => i.id), [2]);
});

test('recognizes addition verbs as direction add', () => {
  const result = parseVoiceCommand('drei Klemmen aufgefüllt', items);
  assert.equal(result.quantity, 3);
  assert.equal(result.direction, 'add');
});

test('defaults to remove when no direction verb is present', () => {
  const result = parseVoiceCommand('eine Lampe', items);
  assert.equal(result.direction, 'remove');
});

test('returns no matches and null quantity for unrecognized text', () => {
  const result = parseVoiceCommand('irgendwas komisches', items);
  assert.equal(result.quantity, null);
  assert.deepEqual(result.matches, []);
});

test('does not false-match an alias inside an unrelated word', () => {
  const result = parseVoiceCommand('eine Lampenfassung entnommen', items);
  assert.deepEqual(result.matches, []);
});
```

Note: the last test documents the word-boundary requirement — "Lampenfassung" must NOT match the "lampe" alias.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/voiceParser.js` does not exist.

- [ ] **Step 3: Implement `js/voiceParser.js`**

```js
const NUMBER_WORDS = {
  ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
  dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19, zwanzig: 20,
};

const REMOVE_KEYWORDS = ['entnommen', 'entnehmen', 'rausgenommen', 'raus genommen', 'verbraucht', 'benutzt'];
const ADD_KEYWORDS = ['aufgefüllt', 'nachgefüllt', 'hinzugefügt', 'eingeräumt', 'ergänzt'];

function normalize(text) {
  return text.toLowerCase().replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractQuantity(normalizedText) {
  const digitMatch = normalizedText.match(/\b(\d+)\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalizedText)) return value;
  }
  return null;
}

function extractDirection(normalizedText) {
  const hasAdd = ADD_KEYWORDS.some((kw) => normalizedText.includes(kw));
  if (hasAdd) return 'add';
  return 'remove';
}

function findMatchingItems(normalizedText, items) {
  return items.filter((item) =>
    item.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return new RegExp(`\\b${escapeRegex(normalizedAlias)}\\b`).test(normalizedText);
    })
  );
}

export function parseVoiceCommand(text, items) {
  const normalizedText = normalize(text);
  return {
    quantity: extractQuantity(normalizedText),
    direction: extractDirection(normalizedText),
    matches: findMatchingItems(normalizedText, items),
    rawText: text,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/voiceParser.js tests/voiceParser.test.js
git commit -m "Add local German voice command parser with word-boundary alias matching"
```

---

### Task 6: Bestandsübersicht (stock list UI, grouped by category, searchable)

**Files:**
- Modify: `js/app.js` (replace stub from Task 1 with full bootstrap + list rendering)
- Create: `js/render.js`

**Interfaces:**
- Consumes: `openDB`, `getAllItems` (Task 2); `seedIfEmpty` (Task 3); `getStatus` (Task 4)
- Produces (used by Tasks 7, 8, 9): `renderItemList(container, items, { onItemClick })` — renders category-grouped item cards into `container`; each card has `data-item-id` and a `.status-dot.ok|.low`
- Produces: a module-level `state = { db, items, movements }` refreshed via `reloadState()`, exported for Tasks 7–11 to reuse instead of re-opening the DB.

- [ ] **Step 1: Implement `js/render.js`**

```js
import { getStatus } from './inventory.js';

export function renderItemList(container, items, { onItemClick } = {}) {
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }

  container.innerHTML = '';
  for (const [category, categoryItems] of byCategory) {
    const group = document.createElement('div');
    group.className = 'category-group';

    const heading = document.createElement('h2');
    heading.textContent = category;
    group.appendChild(heading);

    for (const item of categoryItems.sort((a, b) => a.name.localeCompare(b.name))) {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.dataset.itemId = String(item.id);

      const dot = document.createElement('span');
      dot.className = `status-dot ${getStatus(item)}`;

      const label = document.createElement('span');
      label.textContent = `${item.icon} ${item.name} — ${item.currentQty}/${item.targetQty} ${item.unit}`;

      card.append(dot, label);
      if (onItemClick) card.addEventListener('click', () => onItemClick(item));
      group.appendChild(card);
    }
    container.appendChild(group);
  }
}
```

- [ ] **Step 2: Replace `js/app.js` with the full bootstrap**

```js
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
```

- [ ] **Step 3: Manually verify in-browser**

Run: `npx serve .` (or any static server), open the page.
Expected:
- On first load, the Bestand tab shows all 22 starter items grouped under 7 category headings.
- Typing "wago" into the search field filters the list to just the Wago-Klemme card.
- Items with `currentQty <= minQty` show an orange dot; the rest show green (none should be low on first load, since starter quantities equal their targets).

- [ ] **Step 4: Commit**

```bash
git add js/app.js js/render.js
git commit -m "Add category-grouped, searchable stock list UI"
```

---

### Task 7: Voice-Booking Flow — Confirmation Card, Stepper Fallback, Undo Banner

**Files:**
- Create: `js/confirmCard.js`
- Modify: `js/render.js` (add stepper buttons to each item card)
- Modify: `js/app.js` (wire dictation input, confirm card, undo banner)
- Modify: `css/styles.css` (confirm card + stepper styles)

**Interfaces:**
- Consumes: `parseVoiceCommand` (Task 5), `applyMovement` (Task 4), `addMovement`/`updateItem` (Task 2), `state`/`reloadState` (Task 6)
- Produces (used by Task 8, 9): `showConfirmCard({ item, quantity, direction, onConfirm, onCancel })` — renders into `#confirm-card`, calls `onConfirm(finalQuantity, finalDirection)` when the user taps "Bestätigen", `onCancel()` on "Abbrechen"
- Produces: `showUndoBanner({ message, onUndo })` — renders into `#undo-banner`, auto-hides after 5s if not tapped

- [ ] **Step 1: Implement `js/confirmCard.js`**

```js
export function showConfirmCard({ item, quantity, direction, matches, onConfirm, onCancel }) {
  const el = document.getElementById('confirm-card');
  el.innerHTML = '';
  el.classList.remove('hidden');

  const verb = direction === 'add' ? 'auffüllen' : 'entnehmen';
  const title = document.createElement('p');

  let selectedItem = item ?? (matches && matches.length === 1 ? matches[0] : null);

  if (!selectedItem && matches && matches.length > 1) {
    title.textContent = `Welcher Artikel? (${quantity ?? '?'}× ${verb})`;
  } else if (!selectedItem) {
    title.textContent = 'Artikel nicht erkannt — bitte auswählen';
  } else {
    title.textContent = `${quantity ?? 1}× ${selectedItem.name} ${verb} — bestätigen?`;
  }
  el.appendChild(title);

  if (matches && matches.length > 1) {
    const select = document.createElement('select');
    for (const candidate of matches) {
      const option = document.createElement('option');
      option.value = String(candidate.id);
      option.textContent = candidate.name;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      selectedItem = matches.find((m) => String(m.id) === select.value);
    });
    selectedItem = matches[0];
    el.appendChild(select);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Bestätigen';
  confirmBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onConfirm(selectedItem, quantity ?? 1, direction);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'secondary';
  cancelBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onCancel();
  });

  el.append(confirmBtn, cancelBtn);
}

let undoTimer = null;

export function showUndoBanner({ message, onUndo }) {
  const el = document.getElementById('undo-banner');
  el.innerHTML = '';
  el.classList.remove('hidden');
  clearTimeout(undoTimer);

  const text = document.createElement('span');
  text.textContent = message;

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.textContent = 'Rückgängig';
  undoBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    clearTimeout(undoTimer);
    onUndo();
  });

  el.append(text, undoBtn);
  undoTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}
```

- [ ] **Step 2: Add stepper buttons to `js/render.js`'s `renderItemList`**

Replace the card-building block inside the `for (const item of categoryItems...)` loop with:

```js
    for (const item of categoryItems.sort((a, b) => a.name.localeCompare(b.name))) {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.dataset.itemId = String(item.id);

      const dot = document.createElement('span');
      dot.className = `status-dot ${getStatus(item)}`;

      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = `${item.icon} ${item.name} — ${item.currentQty}/${item.targetQty} ${item.unit}`;

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onStep?.(item, -1);
      });

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onStep?.(item, 1);
      });

      card.append(dot, label, minusBtn, plusBtn);
      if (onItemClick) card.addEventListener('click', () => onItemClick(item));
      group.appendChild(card);
    }
```

And update the function signature at the top of `renderItemList` to destructure `onStep` as well:

```js
export function renderItemList(container, items, { onItemClick, onStep } = {}) {
```

- [ ] **Step 3: Add confirm-card and stepper CSS to `css/styles.css`**

```css
#confirm-card {
  align-items: center;
}

#confirm-card > div, #confirm-card {
  padding: 16px;
}

.stepper-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
}

.item-label { flex: 1; }

button.secondary {
  background: var(--divider);
  color: var(--text);
}
```

- [ ] **Step 4: Wire voice input, stepper, and booking commit into `js/app.js`**

Add these imports at the top:

```js
import { addMovement, updateItem } from './db.js';
import { applyMovement } from './inventory.js';
import { parseVoiceCommand } from './voiceParser.js';
import { showConfirmCard, showUndoBanner } from './confirmCard.js';
```

Add this function and wire it into `renderFilteredList`'s call to `renderItemList`, and add the voice/stepper handlers, right before the `bootstrap()` call at the bottom of the file:

```js
async function commitMovement(item, delta, source) {
  const { updatedItem, movement } = applyMovement(item, delta, source);
  await updateItem(state.db, updatedItem);
  const movementId = await addMovement(state.db, movement);
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
```

Then update `renderFilteredList` to pass the new `onStep` handler:

```js
function renderFilteredList() {
  const query = searchInputEl.value.trim().toLowerCase();
  const filtered = query
    ? state.items.filter((item) => item.name.toLowerCase().includes(query))
    : state.items;
  renderItemList(itemListEl, filtered, { onStep: handleStep });
}
```

- [ ] **Step 5: Manually verify in-browser**

Run: `npx serve .`, open the page.
Expected:
- Typing "2 Wago-Klemmen entnommen" into the voice-input field and clicking "Buchen" shows a confirm card reading "2× Wago-Klemme entnehmen — bestätigen?".
- Tapping "Bestätigen" reduces Wago-Klemme's currentQty by 2, shows an undo banner, and the list re-renders with the new quantity.
- Tapping "Rückgängig" within 5s restores the previous quantity.
- Tapping the "+"/"−" stepper on any item card books a manual movement of 1 without opening the confirm card.
- Typing a phrase matching two items' aliases (e.g. one alias substring shared) shows the disambiguation `<select>` in the confirm card.

- [ ] **Step 6: Commit**

```bash
git add js/confirmCard.js js/render.js js/app.js css/styles.css
git commit -m "Wire voice booking with confirmation card, stepper fallback, and undo"
```

---

### Task 8: Auffüll-Tab (checkable refill list) + Home Screen Icon Badge

**Files:**
- Create: `js/badge.js`
- Create: `tests/badge.test.js`
- Modify: `js/app.js` (render refill tab, wire checkbox, update badge after every state change)

**Interfaces:**
- Consumes: `getRefillList`, `checkoffRefill` (Task 4); `updateItem`, `addMovement` (Task 2)
- Produces (used by Task 6/7/9 wherever state changes): `updateBadge(count, nav = globalThis.navigator): Promise<void>`

- [ ] **Step 1: Write the failing test**

```js
// tests/badge.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateBadge } from '../js/badge.js';

test('calls setAppBadge with the count when supported', async () => {
  const calls = [];
  const fakeNav = { setAppBadge: async (n) => calls.push(['set', n]), clearAppBadge: async () => calls.push(['clear']) };
  await updateBadge(3, fakeNav);
  assert.deepEqual(calls, [['set', 3]]);
});

test('calls clearAppBadge when count is zero', async () => {
  const calls = [];
  const fakeNav = { setAppBadge: async (n) => calls.push(['set', n]), clearAppBadge: async () => calls.push(['clear']) };
  await updateBadge(0, fakeNav);
  assert.deepEqual(calls, [['clear']]);
});

test('no-ops silently when the Badging API is unsupported', async () => {
  await assert.doesNotReject(updateBadge(2, {}));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/badge.js` does not exist.

- [ ] **Step 3: Implement `js/badge.js`**

```js
export async function updateBadge(count, nav = globalThis.navigator) {
  if (!nav || typeof nav.setAppBadge !== 'function') return;
  if (count > 0) {
    await nav.setAppBadge(count);
  } else if (typeof nav.clearAppBadge === 'function') {
    await nav.clearAppBadge();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Add refill-list rendering and checkbox wiring to `js/app.js`**

Add this import:

```js
import { getRefillList, checkoffRefill } from './inventory.js';
import { updateBadge } from './badge.js';
```

Add this function, and call it at the end of both `bootstrap()` and `commitMovement()` (right after `renderFilteredList()` in each):

```js
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
```

- [ ] **Step 6: Call `renderRefillTab()` alongside `renderFilteredList()`**

In `bootstrap()`, after `renderFilteredList();` add `renderRefillTab();`.
In `commitMovement()`, after `renderFilteredList();` add `renderRefillTab();`.
In the undo handler inside `commitMovement()`, after its `renderFilteredList();` add `renderRefillTab();`.

- [ ] **Step 7: Manually verify in-browser**

Run: `npx serve .`, open the page.
Expected:
- Book enough removals (via stepper) on one item to bring it at/below its `minQty` — it now appears under the "Auffüllen" tab with a checkbox.
- Checking that box sets its quantity back to `targetQty`, removes it from the Auffüllen list, and the Bestand tab shows a green dot again.
- With DevTools open to Application → Manifest, confirm no badge-related errors are thrown (the Badging API isn't available in most desktop browsers, so `updateBadge` should no-op without throwing — check the console for the "no-op" case explicitly).

- [ ] **Step 8: Commit**

```bash
git add js/badge.js tests/badge.test.js js/app.js
git commit -m "Add checkable refill tab and home-screen icon badge"
```

---

### Task 9: Artikel-Verlauf (per-item movement history)

**Files:**
- Modify: `js/app.js` (open history modal on item-card click)
- Modify: `css/styles.css` (history modal list styling)

**Interfaces:**
- Consumes: `state.movements` (Task 6), `Movement` shape (Task 2)
- Produces: nothing consumed by later tasks — this is a leaf UI feature

- [ ] **Step 1: Add a history-rendering function and wire it to item-card clicks in `js/app.js`**

Add this function:

```js
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
```

- [ ] **Step 2: Pass `onItemClick` into the `renderItemList` call in `renderFilteredList`**

```js
function renderFilteredList() {
  const query = searchInputEl.value.trim().toLowerCase();
  const filtered = query
    ? state.items.filter((item) => item.name.toLowerCase().includes(query))
    : state.items;
  renderItemList(itemListEl, filtered, { onStep: handleStep, onItemClick: renderItemHistory });
}
```

- [ ] **Step 3: Add history modal CSS to `css/styles.css`**

```css
#item-history-modal {
  flex-direction: column;
  background: var(--bg);
  padding: 16px;
}

#item-history-modal.hidden { display: none; }

.history-list {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  max-height: 60vh;
  overflow-y: auto;
}

.history-list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--divider);
  font-size: 14px;
}
```

- [ ] **Step 4: Manually verify in-browser**

Run: `npx serve .`, open the page.
Expected:
- Clicking anywhere on an item card (not the +/− steppers) opens a modal listing that item's bookings, newest first, each with date, signed delta, source, and resulting quantity.
- An item with no bookings yet shows "Noch keine Buchungen."
- "Schließen" closes the modal.

- [ ] **Step 5: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "Add per-item movement history view"
```

---

### Task 10: Year-End Inventory PDF Export

**Files:**
- Create: `vendor/jspdf.umd.min.js` (vendored library)
- Create: `js/pdfData.js`
- Create: `tests/pdfData.test.js`
- Create: `js/pdfExport.js`
- Modify: `index.html` (load vendored jsPDF before `js/app.js`)
- Modify: `js/app.js` (wire the Inventur tab's year select + export button)

**Interfaces:**
- Consumes: `computeYearStats` (Task 4), `Item[]`/`Movement[]` (Task 2)
- Produces: `buildStockSheetRows(items): Array<{category, name, currentQty, targetQty, unit, status}>` (pure, tested), `buildStatsSheetRows(movements, items, year): Array<{category, name, removals, additions, totalRemovedQty}>` (pure, tested), `generateInventoryPdf(items, movements, year): jsPDF` (impure, manual-tested)

- [ ] **Step 1: Vendor the jsPDF library**

Download the jsPDF UMD build (MIT licensed) and save it as `vendor/jspdf.umd.min.js`. Verify the file starts with a comment/banner mentioning "jsPDF" and defines `window.jspdf.jsPDF` when loaded via a `<script>` tag (open it in a browser console after loading and check `typeof window.jspdf.jsPDF === 'function'`).

- [ ] **Step 2: Write the failing tests for the pure row-builders**

```js
// tests/pdfData.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStockSheetRows, buildStatsSheetRows } from '../js/pdfData.js';

const items = [
  { id: 1, name: 'Wago-Klemme', category: 'Installationsmaterial', unit: 'Stück', currentQty: 5, targetQty: 40, minQty: 10 },
  { id: 2, name: 'LED-Lampe E27', category: 'Beleuchtung/Leuchtmittel', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3 },
];

test('buildStockSheetRows includes status and is sorted by category then name', () => {
  const rows = buildStockSheetRows(items);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, 'Beleuchtung/Leuchtmittel');
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[1].status, 'low');
});

test('buildStatsSheetRows reuses computeYearStats and adds category for table display', () => {
  const movements = [
    { id: 1, itemId: 1, delta: -5, newQty: 5, source: 'voice', timestamp: '2026-02-01T00:00:00Z' },
  ];
  const rows = buildStatsSheetRows(movements, items, 2026);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Wago-Klemme');
  assert.equal(rows[0].removals, 1);
  assert.equal(rows[0].totalRemovedQty, 5);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/pdfData.js` does not exist.

- [ ] **Step 4: Implement `js/pdfData.js`**

```js
import { getStatus, computeYearStats } from './inventory.js';

export function buildStockSheetRows(items) {
  return [...items]
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((item) => ({
      category: item.category,
      name: item.name,
      currentQty: item.currentQty,
      targetQty: item.targetQty,
      unit: item.unit,
      status: getStatus(item),
    }));
}

export function buildStatsSheetRows(movements, items, year) {
  return computeYearStats(movements, items, year)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Implement `js/pdfExport.js` (impure — uses vendored jsPDF global)**

```js
import { buildStockSheetRows, buildStatsSheetRows } from './pdfData.js';

export function generateInventoryPdf(items, movements, year) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Jahresinventur ${year} — Bestand`, 14, 16);
  doc.setFontSize(10);
  let y = 26;
  for (const row of buildStockSheetRows(items)) {
    doc.text(`${row.category} | ${row.name} | ${row.currentQty}/${row.targetQty} ${row.unit} | ${row.status === 'ok' ? 'OK' : 'Knapp'}`, 14, y);
    y += 6;
    if (y > 280) { doc.addPage(); y = 20; }
  }

  doc.addPage();
  doc.setFontSize(16);
  doc.text(`Jahresinventur ${year} — Statistik`, 14, 16);
  doc.setFontSize(10);
  y = 26;
  for (const row of buildStatsSheetRows(movements, items, year)) {
    doc.text(`${row.category} | ${row.name} | Entnahmen: ${row.removals} | Auffüllungen: ${row.additions} | Menge entnommen: ${row.totalRemovedQty}`, 14, y);
    y += 6;
    if (y > 280) { doc.addPage(); y = 20; }
  }

  return doc;
}
```

- [ ] **Step 7: Load vendored jsPDF in `index.html`**

Add this line right before the `<script type="module" src="js/app.js"></script>` line:

```html
  <script src="vendor/jspdf.umd.min.js"></script>
```

- [ ] **Step 8: Wire the Inventur tab in `js/app.js`**

Add this import:

```js
import { generateInventoryPdf } from './pdfExport.js';
```

Add this block, called once from `bootstrap()` after `renderRefillTab();`:

```js
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

populateYearSelect();
```

- [ ] **Step 9: Manually verify in-browser**

Run: `npx serve .`, open the page, go to the "Inventur" tab.
Expected:
- Year dropdown shows the current year and the previous 5 years.
- Clicking "Jahresinventur exportieren" downloads a PDF named `Jahresinventur-<year>.pdf`.
- Opening the PDF shows page 1 with the full stock list (category | name | qty/target | status) and page 2 (a separate page) with per-item removal/addition counts for the selected year.

- [ ] **Step 10: Commit**

```bash
git add vendor/jspdf.umd.min.js js/pdfData.js tests/pdfData.test.js js/pdfExport.js index.html js/app.js
git commit -m "Add two-sheet year-end inventory PDF export"
```

---

### Task 11: Backup / Restore (JSON export & import)

**Files:**
- Create: `js/backup.js`
- Create: `tests/backup.test.js`
- Modify: `js/app.js` (wire export/import buttons)

**Interfaces:**
- Consumes: `Item[]`, `Movement[]` (Task 2); `replaceAllData` (Task 2)
- Produces: `serializeBackup(items, movements): string` (pure), `parseBackup(jsonString): { items: Item[], movements: Movement[] }` (pure, throws `Error` on invalid shape)

- [ ] **Step 1: Write the failing tests**

```js
// tests/backup.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup, parseBackup } from '../js/backup.js';

const items = [{ id: 1, name: 'Wago-Klemme', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 5, targetQty: 40, minQty: 10, aliases: ['wago'] }];
const movements = [{ id: 1, itemId: 1, delta: -2, newQty: 5, source: 'voice', timestamp: '2026-01-01T00:00:00Z' }];

test('serializeBackup produces valid JSON with version, items, and movements', () => {
  const json = serializeBackup(items, movements);
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.items, items);
  assert.deepEqual(parsed.movements, movements);
  assert.ok(parsed.exportedAt);
});

test('parseBackup round-trips a serialized backup', () => {
  const json = serializeBackup(items, movements);
  const result = parseBackup(json);
  assert.deepEqual(result.items, items);
  assert.deepEqual(result.movements, movements);
});

test('parseBackup throws on malformed JSON', () => {
  assert.throws(() => parseBackup('not json'), /Ungültiges Backup-Format/);
});

test('parseBackup throws when items or movements are missing/not arrays', () => {
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, items: 'oops', movements: [] })), /Ungültiges Backup-Format/);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1 })), /Ungültiges Backup-Format/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/backup.js` does not exist.

- [ ] **Step 3: Implement `js/backup.js`**

```js
export function serializeBackup(items, movements) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items, movements }, null, 2);
}

export function parseBackup(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Ungültiges Backup-Format: kein valides JSON.');
  }
  if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.movements)) {
    throw new Error('Ungültiges Backup-Format: "items" und "movements" müssen Arrays sein.');
  }
  return { items: parsed.items, movements: parsed.movements };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Wire export/import buttons in `js/app.js`**

Add these imports:

```js
import { replaceAllData } from './db.js';
import { serializeBackup, parseBackup } from './backup.js';
```

Add this block, called once from `bootstrap()`:

```js
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
  try {
    const { items, movements } = parseBackup(text);
    await replaceAllData(state.db, items, movements);
    await reloadState();
    renderFilteredList();
    renderRefillTab();
    alert('Backup erfolgreich importiert.');
  } catch (err) {
    alert(err.message);
  } finally {
    backupImportInput.value = '';
  }
});
```

- [ ] **Step 6: Manually verify in-browser**

Run: `npx serve .`, open the page, go to "Einstellungen".
Expected:
- "Backup exportieren" downloads a `.json` file containing `version`, `exportedAt`, `items`, `movements`.
- Booking a removal, then importing a previously-exported backup file, restores the quantities from that backup (visible immediately on the Bestand tab).
- Selecting a non-JSON or malformed file shows an alert with a German error message and does not change the current data.

- [ ] **Step 7: Commit**

```bash
git add js/backup.js tests/backup.test.js js/app.js
git commit -m "Add JSON backup export/import"
```

---

### Task 12: Full Offline Support (service worker asset caching)

**Files:**
- Modify: `service-worker.js` (replace registration-only stub with real cache-first asset caching)

**Interfaces:**
- Consumes: nothing from other JS modules (runs in its own worker scope)
- Produces: nothing consumed by other tasks — this is the last piece needed for true offline use

- [ ] **Step 1: Replace `service-worker.js` with a versioned cache-first strategy**

```js
const CACHE_NAME = 'auto-bestand-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/catalog.js',
  './js/inventory.js',
  './js/voiceParser.js',
  './js/badge.js',
  './js/pdfData.js',
  './js/pdfExport.js',
  './js/backup.js',
  './js/render.js',
  './js/confirmCard.js',
  './vendor/jspdf.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 2: Manually verify offline behavior in-browser**

Run: `npx serve .`, open the page once while online (so the service worker installs and caches all assets — check DevTools → Application → Cache Storage shows `auto-bestand-v1` with all listed files).
Then: DevTools → Network → set to "Offline" (or disconnect Wi-Fi), reload the page.
Expected: the app still loads fully, the stock list renders, search/voice-booking/refill-tab/PDF export/backup all still work with no network requests failing.

- [ ] **Step 3: Bump `CACHE_NAME` note for future updates**

No code change needed now — just note in the commit message that `CACHE_NAME` must be incremented (e.g. `auto-bestand-v2`) any time a shipped file changes, so the `activate` handler's cleanup evicts the stale cache.

- [ ] **Step 4: Commit**

```bash
git add service-worker.js
git commit -m "Add full offline asset caching via service worker"
```

---

### Task 13: Deployment to GitHub Pages (private repo)

**Files:**
- Create: `.github/` — none needed; GitHub Pages from a plain branch requires no workflow file
- No source files modified

**Interfaces:** none — this is an operational/deployment task, not a code task.

- [ ] **Step 1: Verify `gh` CLI is authenticated**

Run: `gh auth status`
Expected: shows an authenticated GitHub account. If not authenticated, stop here and ask the user to run `gh auth login` themselves (credential/login flows are not something to run on their behalf).

- [ ] **Step 2: Create the private repository**

Run: `gh repo create auto-bestand --private --source=. --remote=origin`
Expected: repo created under the user's account, `origin` remote added.

- [ ] **Step 3: Push the current branch**

Run: `git push -u origin master`
Expected: push succeeds, branch tracking set up.

- [ ] **Step 4: Enable GitHub Pages on the `master` branch root**

Run: `gh api repos/{owner}/auto-bestand/pages -X POST -f "source[branch]=master" -f "source[path]=/"`
Expected: JSON response with a `html_url` field — this is the live URL.

(If this returns an error because Pages needs a moment after repo creation, retry once after a few seconds.)

- [ ] **Step 5: Confirm the live URL loads**

Run: `curl -sI https://<owner>.github.io/auto-bestand/` (replace `<owner>` with the actual GitHub username)
Expected: `HTTP/2 200` (may take 1-2 minutes after enabling Pages to become live — retry if it 404s immediately).

- [ ] **Step 6: Tell the user the final URL and installation step**

Report the live URL to the user and tell them: open it in Safari on the iPhone, tap the Share icon, choose "Zum Home-Bildschirm" to install it.

---

### Task 14: Item-Verwaltung (Artikel hinzufügen, bearbeiten, löschen)

> Added after the final whole-branch review found that no task implemented the design spec's promised "frei löschbar/erweiterbar" catalog. User decided (2026-07-27) to add this as a follow-up task rather than defer it. User also decided the interaction pattern: buttons inside the existing item-history modal (not real swipe gestures — more reliable to build/verify without a physical touch device in this environment).

**Files:**
- Create: `js/itemForm.js`
- Create: `tests/itemForm.test.js`
- Create: `js/itemFormModal.js`
- Modify: `index.html` (add `#add-item-btn`, `#item-form-modal`)
- Modify: `css/styles.css` (form styling)
- Modify: `js/app.js` (wire add/edit/delete, extend `renderItemHistory` with Bearbeiten/Löschen buttons, route all three through the `commitChain` mutex like every other mutation in this file)

**Interfaces:**
- Consumes: `addItem`, `updateItem`, `deleteItem` (all already in `js/db.js`, Task 2); `state`/`reloadState`/`renderFilteredList`/`renderRefillTab`/`renderItemHistory`/`commitChain` (already in `js/app.js`, Tasks 6–11)
- Produces: `parseItemForm(fields): Item-shaped object (without id/currentQty)` — pure, throws `Error` with a German message on invalid input (mirrors `js/backup.js`'s `parseBackup` error-throwing convention)
- Produces: `showItemFormModal({ mode: 'add'|'edit', item, onSubmit, onCancel })` — renders into `#item-form-modal`; `item` is provided (pre-fills the form) when `mode: 'edit'`, omitted when `mode: 'add'`; calls `onSubmit(rawFieldValues)` with the raw (unparsed) string values from the form on submit, `onCancel()` on cancel

**Design decisions locked in for this task (no further questions needed):**
- Editable fields: Name, Kategorie, Icon (freitext-Emoji, Default `📦` wenn leer), Einheit, Soll-Menge, Mindestmenge, Aliase (Komma-getrennt). `currentQty` is NOT part of the form — it's only ever changed via voice/stepper/checkoff, exactly as today; a brand-new item's `currentQty` is initialized equal to its `targetQty` (assume fully stocked when first added).
- Deleting an item does NOT cascade-delete its movement history (simplest option; `computeYearStats` already skips movements whose `itemId` no longer resolves to a current item, so orphaned movements just silently stop appearing in future stats — no crash, no dangling reference risk). A user who wants to preserve deleted-item history can already do so via the existing JSON backup export.
- "+ Artikel" button lives in the Bestand tab's `#view-bestand`, next to the search bar. "Bearbeiten"/"Löschen" buttons live inside the existing item-history modal (opened by tapping an item card) — added below the history list, above the existing "Schließen" button.
- Delete requires a native `confirm()` before proceeding (same pattern as the backup-import confirmation from the final review fix wave) — deleting is irreversible in the UI.

- [ ] **Step 1: Write the failing tests for `parseItemForm`**

```js
// tests/itemForm.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseItemForm } from '../js/itemForm.js';

const validFields = {
  name: '  Testkabel  ', category: '  Kabel & Leitungen  ', icon: '', unit: 'Meter',
  targetQty: '20', minQty: '5', aliases: 'testkabel, test kabel ,  ',
};

test('parses and normalizes valid form input', () => {
  const item = parseItemForm(validFields);
  assert.equal(item.name, 'Testkabel');
  assert.equal(item.category, 'Kabel & Leitungen');
  assert.equal(item.icon, '📦');
  assert.equal(item.unit, 'Meter');
  assert.equal(item.targetQty, 20);
  assert.equal(item.minQty, 5);
  assert.deepEqual(item.aliases, ['testkabel', 'test kabel']);
});

test('keeps a provided icon instead of the default', () => {
  const item = parseItemForm({ ...validFields, icon: '🔌' });
  assert.equal(item.icon, '🔌');
});

test('throws a German error when name is empty', () => {
  assert.throws(() => parseItemForm({ ...validFields, name: '  ' }), /Name/);
});

test('throws a German error when targetQty is not a valid non-negative number', () => {
  assert.throws(() => parseItemForm({ ...validFields, targetQty: 'abc' }), /Soll-Menge/);
  assert.throws(() => parseItemForm({ ...validFields, targetQty: '-1' }), /Soll-Menge/);
});

test('throws a German error when minQty exceeds targetQty', () => {
  assert.throws(() => parseItemForm({ ...validFields, minQty: '25' }), /Mindestmenge/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/itemForm.js` does not exist.

- [ ] **Step 3: Implement `js/itemForm.js`**

```js
export function parseItemForm(fields) {
  const name = (fields.name ?? '').trim();
  const category = (fields.category ?? '').trim();
  const icon = (fields.icon ?? '').trim() || '📦';
  const unit = (fields.unit ?? '').trim();
  const targetQty = Number(fields.targetQty);
  const minQty = Number(fields.minQty);
  const aliases = (fields.aliases ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.length > 0);

  const errors = [];
  if (!name) errors.push('Name darf nicht leer sein.');
  if (!category) errors.push('Kategorie darf nicht leer sein.');
  if (!unit) errors.push('Einheit darf nicht leer sein.');
  if (!Number.isFinite(targetQty) || targetQty < 0) errors.push('Soll-Menge muss eine Zahl ≥ 0 sein.');
  if (!Number.isFinite(minQty) || minQty < 0) errors.push('Mindestmenge muss eine Zahl ≥ 0 sein.');
  if (Number.isFinite(minQty) && Number.isFinite(targetQty) && minQty > targetQty) {
    errors.push('Mindestmenge darf nicht größer als Soll-Menge sein.');
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return { name, category, icon, unit, targetQty, minQty, aliases };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/itemForm.js tests/itemForm.test.js
git commit -m "Add pure item-form parsing and validation"
```

- [ ] **Step 6: Add `#add-item-btn` and `#item-form-modal` to `index.html`**

In `#view-bestand`, right after the closing `</div>` of `voice-booking` and before `#item-list`, add:

```html
    <button id="add-item-btn" type="button">+ Artikel</button>
```

Near the other overlay divs (alongside `#confirm-card`, `#undo-banner`, `#item-history-modal`), add:

```html
  <div id="item-form-modal" class="overlay hidden" role="dialog" aria-modal="true"></div>
```

- [ ] **Step 7: Implement `js/itemFormModal.js`**

```js
export function showItemFormModal({ mode, item, onSubmit, onCancel }) {
  const el = document.getElementById('item-form-modal');
  el.innerHTML = '';
  el.classList.remove('hidden');

  const body = document.createElement('div');
  body.className = 'confirm-body';

  const title = document.createElement('h3');
  title.textContent = mode === 'edit' ? `Artikel bearbeiten: ${item.name}` : 'Neuer Artikel';
  body.appendChild(title);

  const fieldDefs = [
    ['name', 'Name', 'text', item?.name ?? ''],
    ['category', 'Kategorie', 'text', item?.category ?? ''],
    ['icon', 'Icon (Emoji)', 'text', item?.icon ?? ''],
    ['unit', 'Einheit', 'text', item?.unit ?? ''],
    ['targetQty', 'Soll-Menge', 'number', item?.targetQty ?? ''],
    ['minQty', 'Mindestmenge', 'number', item?.minQty ?? ''],
    ['aliases', 'Aliase (Komma-getrennt)', 'text', (item?.aliases ?? []).join(', ')],
  ];

  const inputs = {};
  for (const [key, label, type, value] of fieldDefs) {
    const wrapper = document.createElement('label');
    wrapper.className = 'form-field';
    wrapper.textContent = label;

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    if (type === 'number') input.min = '0';
    wrapper.appendChild(input);
    body.appendChild(wrapper);
    inputs[key] = input;
  }

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.textContent = mode === 'edit' ? 'Speichern' : 'Hinzufügen';
  submitBtn.addEventListener('click', () => {
    const rawFields = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
    el.classList.add('hidden');
    onSubmit(rawFields);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'secondary';
  cancelBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onCancel();
  });

  actions.append(submitBtn, cancelBtn);
  body.appendChild(actions);
  el.appendChild(body);
}
```

- [ ] **Step 8: Add form-field CSS to `css/styles.css`**

```css
.form-field {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-field input {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: var(--bg);
  color: var(--text);
  font-size: 16px;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.confirm-actions button {
  flex: 1;
}
```

- [ ] **Step 9: Wire add/edit/delete into `js/app.js`**

Add these imports:

```js
import { parseItemForm } from './itemForm.js';
import { showItemFormModal } from './itemFormModal.js';
import { addItem, deleteItem } from './db.js';
```

Add these functions (mirroring the existing `commitChain`-routed pattern used by `doCommitMovement`/`doUndoMovement`/`doCheckoffRefill`/`doImportBackup` — read those in the current file first and match their structure exactly, including calling `hideUndoBanner()` at the start of each, since these mutations should also invalidate any stale undo banner per the final-review fix):

```js
async function doAddItem(rawFields) {
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
```

Wire the "+ Artikel" button:

```js
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
```

Extend `renderItemHistory(item)` (find the current implementation and add these two buttons right before its existing "Schließen" button, inside the same modal element):

```js
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
```

- [ ] **Step 10: Manually verify in-browser**

Run: `npx serve .`, open the page, resize to 375×812.
Expected:
- "+ Artikel" opens an empty form; filling it in and submitting adds a new item that appears in the correct category group, fully stocked (`currentQty === targetQty`).
- Submitting with an empty name (or `minQty > targetQty`) shows a German `alert()` and does not add anything.
- Tapping an existing item card → history modal → "Bearbeiten" opens the form pre-filled with that item's current values (not including `currentQty`); saving updates the item in place (same `id`, `currentQty` unchanged, other fields updated) and the Bestand tab reflects the change immediately.
- "Löschen" asks for confirmation; confirming removes the item from the Bestand list and Auffüllen tab (if it was there); cancelling leaves everything unchanged.
- Deleting an item that has movement history does not crash anything — the Inventur PDF export and history view for other items keep working normally.

- [ ] **Step 11: Commit**

```bash
git add index.html css/styles.css js/itemFormModal.js js/app.js
git commit -m "Add item add/edit/delete via history-modal buttons"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Lager-Verwaltung (Task 6/7), Sprachsteuerung (Task 5/7), automatischer Abgleich (Task 4/7), automatische Erinnerung (Task 8), Auffüll-Ansicht (Task 8), Inventur-PDF (Task 10), lokal/offline (Task 2, 12), Apple-Optik (Task 1), abhakbare Liste (Task 8), Zusatz-Ideen: Backup (Task 11), Undo (Task 7), Suche (Task 6), Verlauf (Task 9), Deployment (Task 13) — all covered.
- **Type consistency checked:** `Item`/`Movement` shapes are identical across Tasks 2–11; `renderItemList(container, items, { onItemClick, onStep })` signature is introduced in Task 6 and extended (not renamed) in Task 7; `state`/`reloadState` from Task 6 are reused as-is through Task 11.
- **No placeholders:** every step above has runnable code or an exact command with expected output.

### Addendum (2026-07-27, post-final-review)

- **Task 14 added:** the original plan self-review claimed full spec coverage but missed that no task actually implements item add/edit/delete, despite the spec's §3/§4 requiring a "frei löschbar/erweiterbar" catalog. Found by the final whole-branch review, confirmed as a genuine plan gap (not an implementation defect), and added as Task 14 per user decision. Interaction pattern (buttons in the existing history modal, not swipe gestures) was also a user decision, made for testability in an environment without a physical touch device.
- A separate bundled fix wave (commits `189bb3c`..`0524a8c`) addressed 5 Important + 10 Minor findings from that same final review before Task 14 was written; see `.superpowers/sdd/final-review-fix-report.md` and the re-review transcript in session history for full detail. Known non-blocking follow-ups from that re-review (deferred, not part of any task): the voice-match ranking heuristic still mis-defaults one real catalog pair ("LED-Lampe GU10" vs "LED-Lampe E27"); two narrow busy-queue races remain in undo-banner invalidation; the PDF stats-sheet loop (as opposed to the stock-sheet loop, which was fixed) can still emit a blank page at specific row counts — newly reachable once Task 14 ships.

