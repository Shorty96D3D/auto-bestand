export function showItemFormModal({ mode, item, onSubmit, onCancel }) {
  const el = document.getElementById('item-form-modal');
  el.innerHTML = '';
  el.classList.remove('hidden');

  const body = document.createElement('div');
  body.className = 'confirm-body';

  const title = document.createElement('h3');
  title.textContent = mode === 'edit' ? `Artikel bearbeiten: ${item.name}` : 'Neuer Artikel';
  body.appendChild(title);

  const fieldDefs = [
    ['name', 'Name', 'text', item?.name ?? ''],
    ['category', 'Kategorie', 'text', item?.category ?? ''],
    ['icon', 'Icon (Emoji)', 'text', item?.icon ?? ''],
    ['unit', 'Einheit', 'text', item?.unit ?? ''],
    ['targetQty', 'Soll-Menge', 'number', item?.targetQty ?? ''],
    ['minQty', 'Mindestmenge', 'number', item?.minQty ?? ''],
    ['aliases', 'Aliase (Komma-getrennt)', 'text', (item?.aliases ?? []).join(', ')],
  ];

  const inputs = {};
  for (const [key, label, type, value] of fieldDefs) {
    const wrapper = document.createElement('label');
    wrapper.className = 'form-field';
    wrapper.textContent = label;

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    if (type === 'number') input.min = '0';
    wrapper.appendChild(input);
    body.appendChild(wrapper);
    inputs[key] = input;
  }

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.textContent = mode === 'edit' ? 'Speichern' : 'Hinzufügen';
  submitBtn.addEventListener('click', () => {
    const rawFields = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
    el.classList.add('hidden');
    onSubmit(rawFields);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'secondary';
  cancelBtn.addEventListener('click', () => {
    el.classList.add('hidden');
    onCancel();
  });

  actions.append(submitBtn, cancelBtn);
  body.appendChild(actions);
  el.appendChild(body);
}
