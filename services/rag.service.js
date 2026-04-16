'use strict';

/**
 * rag.service.js — ChromaDB vector store integration for StudyTrack.
 *
 * Responsibilities:
 *  - Connect to the local ChromaDB container (CHROMA_URL env, default http://chromadb:8000)
 *  - Chunk plain-text documents and upsert them into a per-track collection
 *  - Retrieve the most relevant chunks for a given query to feed into AI prompts
 *
 * ChromaDB JS client uses its own built-in embedding function (all-MiniLM-L6-v2
 * served inside the Docker image) when no custom function is provided.
 */

const { ChromaClient } = require('chromadb');

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const CHUNK_SIZE   = 500;   // characters per chunk
const CHUNK_OVERLAP = 80;   // overlap to preserve context across boundaries
const DEFAULT_N_RESULTS = 5;

/** @type {ChromaClient | null} */
let _client = null;

function _getClient() {
  if (!_client) {
    _client = new ChromaClient({ path: CHROMA_URL });
  }
  return _client;
}

/**
 * Returns the ChromaDB collection name for a given track ID.
 * @param {string} trackId
 * @returns {string}
 */
function _collectionName(trackId) {
  // Collection names must be alphanumeric + hyphens, 3–63 chars
  return `track-${String(trackId).replace(/[^a-zA-Z0-9]/g, '-').slice(0, 55)}`;
}

/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @returns {string[]}
 */
function _chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.trim().length > 0);
}

/**
 * Upsert study material for a given track into ChromaDB.
 *
 * @param {object} params
 * @param {string} params.trackId   - Objective/track ID
 * @param {string} params.docId     - Unique document identifier (e.g. "notes-day-1")
 * @param {string} params.text      - Plain text content to embed and store
 * @returns {Promise<{ chunksAdded: number }>}
 */
async function upsertDocument({ trackId, docId, text }) {
  const client = _getClient();
  const collectionName = _collectionName(trackId);

  const collection = await client.getOrCreateCollection({ name: collectionName });

  const chunks = _chunkText(text);
  if (chunks.length === 0) return { chunksAdded: 0 };

  const ids       = chunks.map((_, i) => `${docId}-chunk-${i}`);
  const documents = chunks;
  const metadatas = chunks.map((_, i) => ({ trackId, docId, chunkIndex: i }));

  await collection.upsert({ ids, documents, metadatas });
  return { chunksAdded: chunks.length };
}

/**
 * Query the vector store for relevant context for a given track and query.
 *
 * @param {object} params
 * @param {string} params.trackId   - Objective/track ID to scope the search
 * @param {string} params.query     - Natural-language query
 * @param {number} [params.n]       - Number of results (default 5)
 * @returns {Promise<string>}       - Concatenated relevant text chunks
 */
async function queryContext({ trackId, query, n = DEFAULT_N_RESULTS }) {
  const client = _getClient();
  const collectionName = _collectionName(trackId);

  let collection;
  try {
    collection = await client.getCollection({ name: collectionName });
  } catch {
    // Collection doesn't exist yet — return empty context
    return '';
  }

  const results = await collection.query({
    queryTexts: [query],
    nResults: n,
  });

  const docs = results.documents?.[0] ?? [];
  return docs.join('\n\n');
}

/**
 * Delete all documents for a track collection (e.g. when a track is removed).
 * @param {string} trackId
 * @returns {Promise<void>}
 */
async function deleteTrackCollection(trackId) {
  const client = _getClient();
  const collectionName = _collectionName(trackId);
  try {
    await client.deleteCollection({ name: collectionName });
  } catch {
    // Collection may not exist — ignore
  }
}

module.exports = {
  upsertDocument,
  queryContext,
  deleteTrackCollection,
};
