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
