import config from '../config/index.js';

/**
 * Detects if a message is purely chitchat, greeting, or polite closing.
 * If true, can bypass heavy vector search to respond in < 1 second.
 */
export function isChitchatOrGreeting(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();

  // Anything longer than 45 characters is likely a substantive inquiry
  if (clean.length > 45) return false;

  // Multilingual greetings (EN, ID, ES) with optional honorifics (kak, min, sir, bro, there, all)
  const greetingPattern = /^(?:halo|hai|hey|hi|hello|hola|pagi|siang|sore|malam|good\s+(?:morning|afternoon|evening)|assalamu['’]?alaikum|p|bot|ping)(?:[\s!.,?]+(?:kak|min|gan|admin|sir|bro|there|all|everyone))?[\s!.,?]*$/i;
  
  // Gratitude (with optional intensifiers like banyak, so much, a lot)
  const gratitudePattern = /^(?:makasih|terima\s*kasih|tq|thanks|thank\s*you|gracias|matur\s*suwun|nuhun)(?:[\s!.,]+(?:banyak|banget|pisan|so\s*much|a\s*lot))?[\s!.,]*(?:ya|kak|min|gan|sir|bro|admin)?$/i;

  // Acknowledgement / Confirmation
  const confirmPattern = /^(?:oke|ok|okee|siap|baik|noted|sip|yes|yep|iya|sudah\s*paham|sudah\s*jelas|clear)[\s!.,]*(?:kak|min|terima\s*kasih)?$/i;

  return greetingPattern.test(clean) || gratitudePattern.test(clean) || confirmPattern.test(clean);
}

/**
 * Contextual Query Rewriter (Condense Question).
 * Rewrites ambiguous follow-up questions ("how much is it?", "what are the requirements?")
 * into self-contained search queries based on recent conversation history.
 */
export async function condenseQuery(history, queryText, callLLMFn) {
  if (!history || history.length === 0 || !queryText) {
    return queryText;
  }

  const cleanQuery = queryText.trim();

  // If query is already long and self-contained (> 60 chars), skip rewrite to save latency
  if (cleanQuery.length > 60) {
    return cleanQuery;
  }

  // Reference indicators across languages
  const hasReference = /\b(it|this|that|these|those|the price|the fee|requirements|schedule|itu|tersebut|tadi|nya|biayanya|syaratnya|jadwalnya|harganya|alamatnya|cara daftarnya)\b/i.test(cleanQuery);
  const isShortQuery = cleanQuery.split(/\s+/).length <= 4;

  if (!hasReference && !isShortQuery) {
    return cleanQuery;
  }

  // Prepare recent context (last 4 turns)
  const recentTurns = history.slice(-4).map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`).join('\n');

  const rewritePrompt = `Given the following conversation history and a follow-up question, rephrase the follow-up question into a standalone, concise search query that contains all necessary entities and context. Do NOT answer the question, only return the rephrased query.

CONVERSATION HISTORY:
${recentTurns}

FOLLOW-UP QUESTION:
${cleanQuery}

STANDALONE SEARCH QUERY:`;

  try {
    if (typeof callLLMFn === 'function') {
      const rewritten = await callLLMFn(rewritePrompt, { temperature: 0.0, max_tokens: 50 });
      if (rewritten && rewritten.trim().length >= 4 && rewritten.trim().length <= 150) {
        return rewritten.trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (err) {
    // Graceful fallback to original query
  }

  return cleanQuery;
}

export default {
  isChitchatOrGreeting,
  condenseQuery
};
