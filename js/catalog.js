export const STARTER_CATALOG = [
  { name: 'NYM-J 3x1,5', category: 'Kabel & Leitungen', icon: '🔌', unit: 'Meter', currentQty: 50, targetQty: 50, minQty: 15, aliases: ['nym 3x1,5', 'kabel 3x1,5'] },
  { name: 'NYM-J 5x2,5', category: 'Kabel & Leitungen', icon: '🔌', unit: 'Meter', currentQty: 30, targetQty: 30, minQty: 10, aliases: ['nym 5x2,5', 'kabel 5x2,5'] },
  { name: 'Aderendhülsen', category: 'Kabel & Leitungen', icon: '🔌', unit: 'Stück', currentQty: 200, targetQty: 200, minQty: 50, aliases: ['aderendhülse', 'aderendhülsen', 'endhülsen'] },

  { name: 'Wago-Klemme', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 40, targetQty: 40, minQty: 10, aliases: ['wago', 'wagoklemme', 'wago klemme', 'klemme'] },
  { name: 'Abzweigdose', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 15, targetQty: 15, minQty: 5, aliases: ['abzweigdose', 'abzweigdosen'] },
  { name: 'Steckdose', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 20, targetQty: 20, minQty: 5, aliases: ['steckdose', 'steckdosen'] },
  { name: 'Schalter', category: 'Installationsmaterial', icon: '🧰', unit: 'Stück', currentQty: 20, targetQty: 20, minQty: 5, aliases: ['schalter'] },

  { name: 'LS-Schalter B16', category: 'Sicherungstechnik', icon: '⚡', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['ls schalter b16', 'leitungsschutzschalter b16', 'b16'] },
  { name: 'FI-Schutzschalter', category: 'Sicherungstechnik', icon: '⚡', unit: 'Stück', currentQty: 5, targetQty: 5, minQty: 2, aliases: ['fi schalter', 'fi schutzschalter', 'fehlerstromschutzschalter'] },
  { name: 'Feinsicherung', category: 'Sicherungstechnik', icon: '⚡', unit: 'Stück', currentQty: 20, targetQty: 20, minQty: 5, aliases: ['feinsicherung', 'feinsicherungen'] },

  { name: 'Isolierband', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['isolierband'] },
  { name: 'Kabelbinder', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 100, targetQty: 100, minQty: 20, aliases: ['kabelbinder'] },
  { name: 'Schrumpfschlauch', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 50, targetQty: 50, minQty: 10, aliases: ['schrumpfschlauch'] },
  { name: 'Dübel & Schrauben', category: 'Verbrauchsmaterial', icon: '🧵', unit: 'Stück', currentQty: 100, targetQty: 100, minQty: 20, aliases: ['dübel', 'schrauben', 'dübel und schrauben'] },

  { name: 'LED-Lampe E27', category: 'Beleuchtung/Leuchtmittel', icon: '💡', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['led e27', 'led lampe', 'glühbirne', 'lampe'] },
  { name: 'LED-Lampe GU10', category: 'Beleuchtung/Leuchtmittel', icon: '💡', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 3, aliases: ['led gu10', 'gu10'] },
  { name: 'Notlicht-Akku', category: 'Beleuchtung/Leuchtmittel', icon: '💡', unit: 'Stück', currentQty: 5, targetQty: 5, minQty: 2, aliases: ['notlicht akku', 'notlichtakku'] },

  { name: 'Isolierhandschuhe', category: 'Arbeitsschutz (PSA)', icon: '🦺', unit: 'Paar', currentQty: 3, targetQty: 3, minQty: 1, aliases: ['isolierhandschuhe', 'handschuhe'] },
  { name: 'Schutzbrille', category: 'Arbeitsschutz (PSA)', icon: '🦺', unit: 'Stück', currentQty: 2, targetQty: 2, minQty: 1, aliases: ['schutzbrille'] },
  { name: 'Warnweste', category: 'Arbeitsschutz (PSA)', icon: '🦺', unit: 'Stück', currentQty: 2, targetQty: 2, minQty: 1, aliases: ['warnweste'] },

  { name: 'Batterien Multimeter', category: 'Mess-/Kleinzubehör', icon: '🔋', unit: 'Stück', currentQty: 10, targetQty: 10, minQty: 4, aliases: ['batterien', 'batterie multimeter'] },
  { name: 'Prüfspitzen', category: 'Mess-/Kleinzubehör', icon: '🔋', unit: 'Set', currentQty: 2, targetQty: 2, minQty: 1, aliases: ['prüfspitzen', 'pruefspitzen'] },
];

export async function seedIfEmpty(db) {
  const { getAllItems, addItem } = await import('./db.js');
  const existing = await getAllItems(db);
  if (existing.length > 0) return;
  for (const item of STARTER_CATALOG) {
    await addItem(db, item);
  }
}
