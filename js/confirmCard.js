export function showConfirmCard({ item, quantity, direction, matches, allItems, onConfirm, onCancel }) {
  const el = document.getElementById('confirm-card');
  el.innerHTML = '';
  el.classList.remove('hidden');

  // Everything lives inside one elevated card so the overlay stays a plain
  // backdrop; the card itself is a vertical stack that fits a 375px viewport.
  const body = document.createElement('div');
  body.className = 'confirm-body';

  const verb = direction === 'add' ? 'auffüllen' : 'entnehmen';

  let selectedItem = item ?? (matches && matches.length === 1 ? matches[0] : null);
  let userPicked = false;

  // Which list (if any) feeds the <select>: the parser's candidates when it
  // found several, or the FULL catalog when it recognised nothing at all — a
  // zero-match dictation must open the card for manual selection (design §5),
  // never dead-end silently.
  let options = null;
  if (matches && matches.length > 1) {
    options = matches;
    if (!selectedItem) selectedItem = matches[0];
  } else if (!selectedItem && Array.isArray(allItems) && allItems.length > 0) {
    options = allItems;
    // Nothing was recognised — force an explicit pick instead of defaulting to
    // an arbitrary catalog entry.
    selectedItem = null;
  }

  const title = document.createElement('p');
  title.className = 'confirm-title';

  function refreshTitle() {
    if (!selectedItem) {
      title.textContent = 'Artikel nicht erkannt — bitte auswählen';
    } else if (options) {
      // Name the item that "Bestätigen" would actually book, so the user does
      // not have to open the dropdown to find out.
      title.textContent = `${userPicked ? 'Gewählt' : 'Standard'}: ${selectedItem.name} — ${verb}?`;
    } else {
      title.textContent = `${selectedItem.name} ${verb} — bestätigen?`;
    }
  }
  refreshTitle();

  const qtyRow = document.createElement('label');
  qtyRow.className = 'confirm-qty';
  const qtyLabel = document.createElement('span');
  qtyLabel.textContent = 'Menge';
  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '1';
  qtyInput.step = '1';
  qtyInput.inputMode = 'numeric';
  qtyInput.value = String(Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  qtyRow.append(qtyLabel, qtyInput);

  function readQuantity() {
    const parsed = parseInt(qtyInput.value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Bestätigen';
  // Only block confirming when a selector is actually on screen to pick from.
  confirmBtn.disabled = !selectedItem && Boolean(options);
  confirmBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    // Always hand back the live quantity from the input, not the (possibly
    // misheard or missing) parsed one.
    onConfirm(selectedItem, readQuantity(), direction);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'secondary';
  cancelBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onCancel();
  });

  actions.append(confirmBtn, cancelBtn);

  let select = null;
  if (options) {
    select = document.createElement('select');
    select.className = 'confirm-select';
    if (!selectedItem) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Artikel wählen —';
      select.appendChild(placeholder);
    }
    for (const candidate of options) {
      const option = document.createElement('option');
      option.value = String(candidate.id);
      option.textContent = candidate.name;
      select.appendChild(option);
    }
    select.value = selectedItem ? String(selectedItem.id) : '';
    select.addEventListener('change', () => {
      selectedItem = options.find((c) => String(c.id) === select.value) ?? null;
      userPicked = true;
      confirmBtn.disabled = !selectedItem;
      refreshTitle();
    });
  }

  body.appendChild(title);
  if (select) body.appendChild(select);
  body.appendChild(qtyRow);
  body.appendChild(actions);
  el.appendChild(body);
}

let undoTimer = null;

export function hideUndoBanner() {
  clearTimeout(undoTimer);
  undoTimer = null;
  const el = document.getElementById('undo-banner');
  if (el) el.classList.add('hidden');
}

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
    hideUndoBanner();
    onUndo();
  });

  el.append(text, undoBtn);
  undoTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}
