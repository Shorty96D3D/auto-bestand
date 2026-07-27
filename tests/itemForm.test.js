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
