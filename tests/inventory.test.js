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

test('applyMovement clamps currentQty at 0 and records the effective delta', () => {
  const { updatedItem, movement } = applyMovement(baseItem, -999, 'manual');
  assert.equal(updatedItem.currentQty, 0);
  // Only 12 were actually available, so only -12 may be booked — otherwise the
  // Jahresinventur statistics would report 999 units consumed.
  assert.equal(movement.delta, -12);
  assert.equal(movement.newQty, 0);
});

test('computeYearStats counts only the effective quantity of a clamped removal', () => {
  const { movement } = applyMovement({ ...baseItem, currentQty: 1 }, -5, 'voice', new Date('2026-05-04T10:00:00Z'));
  const stats = computeYearStats([{ id: 1, ...movement }], [baseItem], 2026);
  assert.equal(stats[0].removals, 1);
  assert.equal(stats[0].totalRemovedQty, 1);
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
