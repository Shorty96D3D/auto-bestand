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
