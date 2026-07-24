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
