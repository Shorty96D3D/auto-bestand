export function parseItemForm(fields) {
  const name = (fields.name ?? '').trim();
  const category = (fields.category ?? '').trim();
  const icon = (fields.icon ?? '').trim() || '📦';
  const unit = (fields.unit ?? '').trim();
  const targetQty = Number(fields.targetQty);
  const minQty = Number(fields.minQty);
  const aliases = (fields.aliases ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.length > 0);

  const errors = [];
  if (!name) errors.push('Name darf nicht leer sein.');
  if (!category) errors.push('Kategorie darf nicht leer sein.');
  if (!unit) errors.push('Einheit darf nicht leer sein.');
  if (!Number.isFinite(targetQty) || targetQty < 0) errors.push('Soll-Menge muss eine Zahl ≥ 0 sein.');
  if (!Number.isFinite(minQty) || minQty < 0) errors.push('Mindestmenge muss eine Zahl ≥ 0 sein.');
  if (Number.isFinite(minQty) && Number.isFinite(targetQty) && minQty > targetQty) {
    errors.push('Mindestmenge darf nicht größer als Soll-Menge sein.');
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return { name, category, icon, unit, targetQty, minQty, aliases };
}
