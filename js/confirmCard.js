export function showConfirmCard({ item, quantity, direction, matches, onConfirm, onCancel }) {
  const el = document.getElementById('confirm-card');
  el.innerHTML = '';
  el.classList.remove('hidden');

  const verb = direction === 'add' ? 'auffüllen' : 'entnehmen';
  const title = document.createElement('p');

  let selectedItem = item ?? (matches && matches.length === 1 ? matches[0] : null);

  if (!selectedItem && matches && matches.length > 1) {
    title.textContent = `Welcher Artikel? (${quantity ?? '?'}× ${verb})`;
  } else if (!selectedItem) {
    title.textContent = 'Artikel nicht erkannt — bitte auswählen';
  } else {
    title.textContent = `${quantity ?? 1}× ${selectedItem.name} ${verb} — bestätigen?`;
  }
  el.appendChild(title);

  if (matches && matches.length > 1) {
    const select = document.createElement('select');
    for (const candidate of matches) {
      const option = document.createElement('option');
      option.value = String(candidate.id);
      option.textContent = candidate.name;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      selectedItem = matches.find((m) => String(m.id) === select.value);
    });
    selectedItem = matches[0];
    el.appendChild(select);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Bestätigen';
  confirmBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onConfirm(selectedItem, quantity ?? 1, direction);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'secondary';
  cancelBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onCancel();
  });

  el.append(confirmBtn, cancelBtn);
}

let undoTimer = null;

export function showUndoBanner({ message, onUndo }) {
  const el = document.getElementById('undo-banner');
  el.innerHTML = '';
  el.classList.remove('hidden');
  clearTimeout(undoTimer);

  const text = document.createElement('span');
  text.textContent = message;

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.textContent = 'Rückgängig';
  undoBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    clearTimeout(undoTimer);
    onUndo();
  });

  el.append(text, undoBtn);
  undoTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}
