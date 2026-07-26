const NUMBER_WORDS = {
  ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
  dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19, zwanzig: 20,
};

const REMOVE_KEYWORDS = ['entnommen', 'entnehmen', 'rausgenommen', 'raus genommen', 'verbraucht', 'benutzt'];
const ADD_KEYWORDS = ['aufgefüllt', 'nachgefüllt', 'hinzugefügt', 'eingeräumt', 'ergänzt'];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,;:!?]/g, '')
    // Hyphens are word separators here: dictation and typing both produce
    // "LS-Schalter B16" while the alias is stored as "ls schalter b16".
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractQuantity(normalizedText) {
  const digitMatch = normalizedText.match(/\b(\d+)\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalizedText)) return value;
  }
  return null;
}

function extractDirection(normalizedText) {
  if (ADD_KEYWORDS.some((kw) => normalizedText.includes(kw))) return 'add';
  if (REMOVE_KEYWORDS.some((kw) => normalizedText.includes(kw))) return 'remove';
  // Removal is the main use case, so it stays the default when no signal word
  // was said at all.
  return 'remove';
}

// Length of the longest alias of `item` that occurs in the text, or 0 if none does.
function matchedAliasLength(normalizedText, item) {
  let longest = 0;
  for (const alias of item.aliases) {
    const normalizedAlias = normalize(alias);
    const pattern = new RegExp(`\\b${escapeRegex(normalizedAlias)}(?:e|en|n|s)?\\b`);
    if (pattern.test(normalizedText) && normalizedAlias.length > longest) {
      longest = normalizedAlias.length;
    }
  }
  return longest;
}

function findMatchingItems(normalizedText, items) {
  return items
    .map((item) => ({ item, aliasLength: matchedAliasLength(normalizedText, item) }))
    .filter((entry) => entry.aliasLength > 0)
    // Most specific match first: the longest matched alias wins, so
    // "LS-Schalter B16" outranks the generic "Schalter" and becomes the
    // default selection in the confirmation card. Sort is stable, so items
    // whose matched aliases are equally long keep catalog order.
    .sort((a, b) => b.aliasLength - a.aliasLength)
    .map((entry) => entry.item);
}

export function parseVoiceCommand(text, items) {
  const normalizedText = normalize(text);
  return {
    quantity: extractQuantity(normalizedText),
    direction: extractDirection(normalizedText),
    matches: findMatchingItems(normalizedText, items),
    rawText: text,
  };
}
