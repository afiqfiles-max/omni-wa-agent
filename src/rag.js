import fs from 'node:fs';
import path from 'node:path';
import { ChromaClient } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';
import config from '../config/index.js';
import { normalizeQuery } from './normalizer.js';

let client = null;
let collection = null;
let embedder = null;

function getClient() {
  if (!client) {
    const url = new URL(config.rag.chromaUrl);
    client = new ChromaClient({
      path: `${url.protocol}//${url.hostname}:${url.port}`
    });
  }
  return client;
}

function getEmbedder() {
  if (!embedder) {
    embedder = new DefaultEmbeddingFunction();
  }
  return embedder;
}

export async function getCollection() {
  if (!collection) {
    const c = getClient();
    const emb = getEmbedder();
    collection = await c.getOrCreateCollection({
      name: config.rag.collectionName,
      embeddingFunction: emb
    });
  }
  return collection;
}

/**
 * Splits markdown and text files into semantically meaningful chunks based on headers.
 */
export function chunkDocument(filePath, content) {
  const fileName = path.basename(filePath);
  const chunks = [];
  
  // Split on Markdown headers (## or ###)
  const sections = content.split(/(?=^#{1,3}\s+)/gm);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section || section.length < 20) continue;

    // Extract first line as title
    const firstLine = section.split('\n')[0].replace(/^#{1,3}\s+/, '').trim();
    
    // If section is very large (> 2500 chars), split into sub-chunks
    if (section.length > 2500) {
      const paragraphs = section.split(/\n\n+/);
      let buffer = '';
      let partIndex = 1;

      for (const p of paragraphs) {
        if ((buffer.length + p.length) > 1800) {
          chunks.push({
            id: `${fileName}-sec${i}-part${partIndex++}`,
            text: buffer.trim(),
            metadata: { file: fileName, section: firstLine }
          });
          buffer = p + '\n\n';
        } else {
          buffer += p + '\n\n';
        }
      }

      if (buffer.trim().length > 20) {
        chunks.push({
          id: `${fileName}-sec${i}-part${partIndex}`,
          text: buffer.trim(),
          metadata: { file: fileName, section: firstLine }
        });
      }
    } else {
      chunks.push({
        id: `${fileName}-sec${i}`,
        text: section,
        metadata: { file: fileName, section: firstLine }
      });
    }
  }

  return chunks;
}

/**
 * Ingests all Markdown and text documents from the knowledge_base directory into ChromaDB.
 */
export async function ingestDocs() {
  const dir = path.resolve(process.cwd(), config.rag.kbDirectory);
  if (!fs.existsSync(dir)) {
    console.warn(`[RAG] Knowledge base directory ${dir} does not exist. Creating it.`);
    fs.mkdirSync(dir, { recursive: true });
    return 0;
  }

  console.log(`[RAG] Reading knowledge base from: ${dir}`);
  const files = fs.readdirSync(dir).filter(f => /\.(md|txt|json)$/i.test(f));

  if (files.length === 0) {
    console.warn('[RAG] No .md, .txt, or .json files found in knowledge base directory.');
    return 0;
  }

  const allChunks = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkDocument(filePath, content);
    allChunks.push(...chunks);
  }

  console.log(`[RAG] Extracted ${allChunks.length} chunks from ${files.length} documents.`);

  const c = getClient();
  const emb = getEmbedder();

  // Reset collection cleanly to prevent stale duplicates
  try {
    await c.deleteCollection({ name: config.rag.collectionName });
  } catch (e) {
    // Collection might not exist yet
  }

  collection = await c.createCollection({
    name: config.rag.collectionName,
    embeddingFunction: emb
  });

  // Batch upsert in chunks of 50
  const batchSize = 50;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    await collection.add({
      ids: batch.map(b => b.id),
      documents: batch.map(b => b.text),
      metadatas: batch.map(b => b.metadata)
    });
  }

  console.log(`[RAG] Successfully indexed ${allChunks.length} chunks into ChromaDB.`);
  return allChunks.length;
}

/**
 * Searches the vector database for the top K relevant documents.
 */
export async function searchDocs(query, topK = 3) {
  if (!query || typeof query !== 'string') return [];

  // Normalize query shorthand before embedding search
  const normalized = normalizeQuery(query) || query;

  try {
    const coll = await getCollection();
    const results = await coll.query({
      queryTexts: [normalized],
      nResults: topK
    });

    if (!results || !results.documents || results.documents.length === 0) {
      return [];
    }

    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = (results.distances && results.distances[0]) || [];

    return docs.map((doc, idx) => ({
      text: doc,
      metadata: metadatas[idx] || {},
      distance: distances[idx] !== undefined ? distances[idx] : null
    }));
  } catch (err) {
    console.error('[RAG] Vector search failed:', err.message);
    return [];
  }
}

export default {
  ingestDocs,
  searchDocs,
  chunkDocument,
  getCollection
};
