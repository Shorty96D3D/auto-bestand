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
