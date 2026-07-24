export async function updateBadge(count, nav = globalThis.navigator) {
  if (!nav || typeof nav.setAppBadge !== 'function') return;
  if (count > 0) {
    await nav.setAppBadge(count);
  } else if (typeof nav.clearAppBadge === 'function') {
    await nav.clearAppBadge();
  }
}
