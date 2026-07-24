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
