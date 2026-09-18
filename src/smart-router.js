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
 * Detects attempts to probe technical bot architecture, request chatbot tutorials,
 * extract system prompts, or abuse the customer support bot as a general coding engine.
 * Supports multilingual triggers (English, Indonesian).
 */
export function isBotMetadataProbe(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  return (
    // Bot creation / tutorial requests
    /(?:bikin|buat|create|develop|build|koding|coding|code|arsitektur|architecture|how it works|source code|stack|tutorial|programming language|bahasa pemrograman).*(?:bot|chatbot|assistant|asisten|sistem|aplikasi|app|system|like you|kayak kamu|seperti kamu|kayak gini|seperti ini)/i.test(lower) ||
    // Technical stack & model probing
    /(?:bot|chatbot|assistant|asisten|app|system).*(?:pakai model apa|pake model apa|what model|what llm|dibuat pakai|codingan apa|bahasa apa|source code|tutorial bikin|tutorial buat|arsitekturnya|architecture|backend|framework|how does.*work|jalan.*bagaimana)/i.test(lower) ||
    // How the app/system operates (handles both EN 'how does this system work' and ID 'bagaimana sistem ini berjalan')
    /(?:how does|how do|explain how|bagaimana|gimana|cara).*(?:this\s+|your\s+|the\s+)?(?:system|app|bot|assistant|aplikasi|sistem|asisten|ai).*(?:work|operate|run|function|built|created|jalan|berjalan|bekerja|dibuat|dibangun)/i.test(lower) ||
    // Tutorial on chatbot making
    /(?:tutorial).*(?:bikin|buat|code|coding|build|develop|create).*(?:bot|chatbot|asisten|assistant)/i.test(lower) ||
    /(?:how to|cara|gimana|bagaimana).*(?:bikin|buat|build|develop|create|code).*(?:bot|chatbot|assistant|asisten)/i.test(lower) ||
    // System prompt extraction
    /(?:system prompt|prompt kamu|prompt anda|your prompt|system instructions|instruksi sistem|initial instructions|prompt verbatim)/i.test(lower) ||
    // Framework / stack interrogation
    /(?:kamu|anda|you|this bot|bot ini|the bot).*(?:pakai model|pake model|what model|llm|backend|database|baileys|langchain|rag|chromadb|python|nodejs)/i.test(lower)
  );
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
  isBotMetadataProbe,
  condenseQuery
};
