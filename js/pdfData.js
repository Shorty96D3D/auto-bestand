import { getStatus, computeYearStats } from './inventory.js';

export function buildStockSheetRows(items) {
  return [...items]
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((item) => ({
      category: item.category,
      name: item.name,
      currentQty: item.currentQty,
      targetQty: item.targetQty,
      unit: item.unit,
      status: getStatus(item),
    }));
}

export function buildStatsSheetRows(movements, items, year) {
  return computeYearStats(movements, items, year)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
