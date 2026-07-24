import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  openDB as openDBReal,
  getAllItems,
  addItem,
  updateItem,
  deleteItem,
  addMovement,
  getAllMovements,
  getMovementsForItem,
  replaceAllData,
} from '../js/db.js';

// Tracks every connection opened via openDB() below so beforeEach can close
// them before deleting the database. IndexedDB's deleteDatabase blocks
// (and any subsequent open() call queues behind it, deadlocking) as long as
// a connection from a prior test is still open, so closing first is required
// for deleteDatabase to actually complete between tests.
let openConnections = [];

function openDB(...args) {
  return openDBReal(...args).then((db) => {
    openConnections.push(db);
    return db;
  });
}

beforeEach(async () => {
  for (const db of openConnections) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  openConnections = [];

  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('autoBestandDB');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // no open connections at this point, but handle defensively
  });
});

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

test('addMovement then getAllMovements returns all added movements with ids', async () => {
  const db = await openDB();
  const id1 = await addMovement(db, {
    itemId: 1, delta: -2, newQty: 3, source: 'manual', timestamp: '2026-07-24T10:00:00.000Z',
  });
  const id2 = await addMovement(db, {
    itemId: 1, delta: 5, newQty: 8, source: 'restock', timestamp: '2026-07-24T11:00:00.000Z',
  });
  const movements = await getAllMovements(db);
  assert.equal(movements.length, 2);

  const m1 = movements.find((m) => m.id === id1);
  const m2 = movements.find((m) => m.id === id2);
  assert.ok(m1);
  assert.ok(m2);
  assert.equal(m1.itemId, 1);
  assert.equal(m1.delta, -2);
  assert.equal(m1.newQty, 3);
  assert.equal(m1.source, 'manual');
  assert.equal(m1.timestamp, '2026-07-24T10:00:00.000Z');
  assert.equal(m2.itemId, 1);
  assert.equal(m2.delta, 5);
  assert.equal(m2.newQty, 8);
  assert.equal(m2.source, 'restock');
  assert.equal(m2.timestamp, '2026-07-24T11:00:00.000Z');
});

test('getMovementsForItem returns only movements matching the given itemId', async () => {
  const db = await openDB();
  await addMovement(db, {
    itemId: 1, delta: -2, newQty: 3, source: 'manual', timestamp: '2026-07-24T10:00:00.000Z',
  });
  await addMovement(db, {
    itemId: 2, delta: 1, newQty: 4, source: 'manual', timestamp: '2026-07-24T10:05:00.000Z',
  });
  await addMovement(db, {
    itemId: 1, delta: 5, newQty: 8, source: 'restock', timestamp: '2026-07-24T11:00:00.000Z',
  });

  const forItem1 = await getMovementsForItem(db, 1);
  assert.equal(forItem1.length, 2);
  assert.ok(forItem1.every((m) => m.itemId === 1));

  const forItem2 = await getMovementsForItem(db, 2);
  assert.equal(forItem2.length, 1);
  assert.equal(forItem2[0].itemId, 2);
});

test('replaceAllData replaces existing items and movements entirely', async () => {
  const db = await openDB();
  await addItem(db, {
    name: 'Old Item', category: 'Old', icon: '📦', unit: 'Stück',
    currentQty: 1, targetQty: 1, minQty: 0, aliases: ['old'],
  });
  await addMovement(db, {
    itemId: 1, delta: 1, newQty: 1, source: 'manual', timestamp: '2026-07-24T09:00:00.000Z',
  });

  const newItems = [
    {
      id: 1, name: 'Motoröl 5W-30', category: 'Flüssigkeiten', icon: '🛢️', unit: 'Liter',
      currentQty: 4, targetQty: 6, minQty: 2, aliases: ['motoroel', 'oel'],
    },
    {
      id: 2, name: 'Bremsflüssigkeit', category: 'Flüssigkeiten', icon: '🧪', unit: 'Liter',
      currentQty: 2, targetQty: 4, minQty: 1, aliases: ['bremsfluessigkeit'],
    },
  ];
  const newMovements = [
    { id: 1, itemId: 1, delta: -1, newQty: 4, source: 'manual', timestamp: '2026-07-24T12:00:00.000Z' },
    { id: 2, itemId: 2, delta: 2, newQty: 2, source: 'restock', timestamp: '2026-07-24T12:30:00.000Z' },
  ];

  await replaceAllData(db, newItems, newMovements);

  const items = await getAllItems(db);
  const movements = await getAllMovements(db);

  assert.equal(items.length, 2);
  assert.deepEqual(items, newItems);
  assert.equal(movements.length, 2);
  assert.deepEqual(movements, newMovements);

  assert.equal(items.find((i) => i.name === 'Old Item'), undefined);
  assert.equal(movements.find((m) => m.source === 'manual' && m.newQty === 1), undefined);
});
