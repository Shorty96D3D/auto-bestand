const NUMBER_WORDS = {
  ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
  dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19, zwanzig: 20,
};

const REMOVE_KEYWORDS = ['entnommen', 'entnehmen', 'rausgenommen', 'raus genommen', 'verbraucht', 'benutzt'];
const ADD_KEYWORDS = ['aufgefüllt', 'nachgefüllt', 'hinzugefügt', 'eingeräumt', 'ergänzt'];

function normalize(text) {
  return text.toLowerCase().replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
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
  const hasAdd = ADD_KEYWORDS.some((kw) => normalizedText.includes(kw));
  if (hasAdd) return 'add';
  return 'remove';
}

function findMatchingItems(normalizedText, items) {
  return items.filter((item) =>
    item.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return new RegExp(`\\b${escapeRegex(normalizedAlias)}(?:e|en|n|s)?\\b`).test(normalizedText);
    })
  );
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
