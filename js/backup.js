export function serializeBackup(items, movements) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items, movements }, null, 2);
}

export function parseBackup(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Ungültiges Backup-Format: kein valides JSON.');
  }
  if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.movements)) {
    throw new Error('Ungültiges Backup-Format: "items" und "movements" müssen Arrays sein.');
  }
  return { items: parsed.items, movements: parsed.movements };
}
