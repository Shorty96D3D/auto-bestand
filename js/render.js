import { getStatus } from './inventory.js';

export function renderItemList(container, items, { onItemClick, onStep } = {}) {
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }

  container.innerHTML = '';
  for (const [category, categoryItems] of byCategory) {
    const group = document.createElement('div');
    group.className = 'category-group';

    const heading = document.createElement('h2');
    heading.textContent = category;
    group.appendChild(heading);

    for (const item of categoryItems.sort((a, b) => a.name.localeCompare(b.name))) {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.dataset.itemId = String(item.id);

      const dot = document.createElement('span');
      dot.className = `status-dot ${getStatus(item)}`;

      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = `${item.icon} ${item.name} — ${item.currentQty}/${item.targetQty} ${item.unit}`;

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onStep?.(item, -1);
      });

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onStep?.(item, 1);
      });

      card.append(dot, label, minusBtn, plusBtn);
      if (onItemClick) card.addEventListener('click', () => onItemClick(item));
      group.appendChild(card);
    }
    container.appendChild(group);
  }
}
