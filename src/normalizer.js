import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

const normalizers = {};

// Load slang dictionaries
try {
  const normalizersDir = path.resolve(process.cwd(), 'config/normalizers');
  if (fs.existsSync(normalizersDir)) {
    const files = fs.readdirSync(normalizersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const lang = path.basename(file, '.json');
      const content = JSON.parse(fs.readFileSync(path.join(normalizersDir, file), 'utf-8'));
      normalizers[lang] = content;
    }
  }
} catch (e) {
  // Silent fallback
}

/**
 * Removes repeated characters (de-elongation): e.g. "kapaaannn" -> "kapan", "pleeease" -> "please", "soooo" -> "so"
 */
export function removeElongation(word) {
  if (!word || typeof word !== 'string') return '';
  return word.replace(/(.)\1{2,}/g, '$1');
}

/**
 * Normalizes user queries by expanding abbreviations, slang, and chat shorthand.
 * Supports Indonesian and English out-of-the-box.
 * @param {string} text - Raw input text
 * @param {string} [preferredLang='auto'] - Specific language code or 'auto' for combined dictionaries
 * @returns {string} Normalized text
 */
export function normalizeQuery(text, preferredLang = 'auto') {
  if (!text || typeof text !== 'string') return '';

  // Strip zero-width characters and invisible unicode spaces
  const cleanText = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleanText) return '';

  // Select dictionary
  let dictionary = {};
  if (preferredLang !== 'auto' && normalizers[preferredLang]) {
    dictionary = normalizers[preferredLang];
  } else {
    // Merge all available dictionaries (ID + EN)
    dictionary = Object.assign({}, normalizers.en || {}, normalizers.id || {});
  }

  // Tokenize words preserving punctuation bounds
  const tokens = cleanText.split(/(\s+|[.,?!;:()]+)/);

  const normalizedTokens = tokens.map(token => {
    if (!token || /^\s+$/.test(token) || /^[.,?!;:()]+$/.test(token)) {
      return token;
    }

    const lower = token.toLowerCase();
    const deElongated = removeElongation(lower);

    if (dictionary[deElongated]) {
      return dictionary[deElongated];
    }
    if (dictionary[lower]) {
      return dictionary[lower];
    }

    return token;
  });

  return normalizedTokens.join('').replace(/\s+/g, ' ').trim();
}

export default {
  normalizeQuery,
  removeElongation
};
