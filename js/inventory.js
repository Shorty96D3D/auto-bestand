export function getStatus(item) {
  return item.currentQty <= item.minQty ? 'low' : 'ok';
}

export function applyMovement(item, delta, source, now = new Date()) {
  const newQty = Math.max(0, item.currentQty + delta);
  const updatedItem = { ...item, currentQty: newQty };
  const movement = { itemId: item.id, delta, newQty, source, timestamp: now.toISOString() };
  return { updatedItem, movement };
}

export function checkoffRefill(item, now = new Date()) {
  const delta = item.targetQty - item.currentQty;
  return applyMovement(item, delta, 'checkoff', now);
}

export function getRefillList(items) {
  return items
    .filter((item) => getStatus(item) === 'low')
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export function computeYearStats(movements, items, year) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const statsByItemId = new Map();

  for (const movement of movements) {
    const movementYear = new Date(movement.timestamp).getUTCFullYear();
    if (movementYear !== year) continue;
    const item = itemsById.get(movement.itemId);
    if (!item) continue;

    if (!statsByItemId.has(item.id)) {
      statsByItemId.set(item.id, { itemId: item.id, name: item.name, category: item.category, removals: 0, additions: 0, totalRemovedQty: 0 });
    }
    const stat = statsByItemId.get(item.id);
    if (movement.delta < 0) {
      stat.removals += 1;
      stat.totalRemovedQty += Math.abs(movement.delta);
    } else if (movement.delta > 0) {
      stat.additions += 1;
    }
  }

  return Array.from(statsByItemId.values());
}
