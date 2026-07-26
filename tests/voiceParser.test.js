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

test('ranks the item with the longest matched alias first', () => {
  const switchItems = [
    // Catalog order deliberately puts the generic switch first.
    { id: 1, name: 'Schalter', category: 'Installationsmaterial', aliases: ['schalter'] },
    { id: 2, name: 'LS-Schalter B16', category: 'Sicherungstechnik', aliases: ['ls schalter b16', 'leitungsschutzschalter b16', 'b16'] },
    { id: 3, name: 'FI-Schutzschalter', category: 'Sicherungstechnik', aliases: ['fi schalter', 'fi schutzschalter'] },
  ];
  const result = parseVoiceCommand('zwei LS-Schalter B16 entnommen', switchItems);
  assert.deepEqual(result.matches.map((i) => i.id), [2, 1]);
  assert.equal(result.matches[0].name, 'LS-Schalter B16');
});

test('prefers the specific breaker over the generic switch for "FI-Schalter"', () => {
  const switchItems = [
    { id: 1, name: 'Schalter', category: 'Installationsmaterial', aliases: ['schalter'] },
    { id: 3, name: 'FI-Schutzschalter', category: 'Sicherungstechnik', aliases: ['fi schalter', 'fi schutzschalter'] },
  ];
  const result = parseVoiceCommand('einen FI-Schalter entnommen', switchItems);
  assert.equal(result.matches[0].name, 'FI-Schutzschalter');
  assert.deepEqual(result.matches.map((i) => i.id), [3, 1]);
});

test('does not false-match an alias inside an unrelated word', () => {
  const result = parseVoiceCommand('eine Lampenfassung entnommen', items);
  assert.deepEqual(result.matches, []);
});
