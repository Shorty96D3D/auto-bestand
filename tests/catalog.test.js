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
