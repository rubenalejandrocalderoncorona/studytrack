'use strict';

/**
 * routes/sync.js — External integration endpoints for raibis-go.
 *
 * GET  /api/tracks/:id
 *   Verify that a Study Track (objective) exists.
 *   Used by raibis-go when creating a "learning" Habit to validate the reference.
 *
 * POST /api/tracks/:id/documents
 *   Upsert a study document into the vector store for a track (for RAG).
 *
 * DELETE /api/tracks/:id/documents
 *   Remove the vector collection for a track.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const rag     = require('../services/rag.service');

const router    = express.Router();
const DATA_FILE = path.join(__dirname, '../data/progress.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProgress() {
  if (!fs.existsSync(DATA_FILE)) return { objectives: [] };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { objectives: [] };
  }
}

// ── GET /api/tracks/:id ───────────────────────────────────────────────────────

/**
 * Returns 200 + objective summary if found, 404 otherwise.
 * This endpoint is intentionally lightweight — raibis-go only calls it to
 * validate existence before creating a learning habit.
 */
router.get('/tracks/:id', (req, res) => {
  const data = loadProgress();
  const obj = data.objectives.find(o => o.id === req.params.id);
  if (!obj) return res.status(404).json({ error: 'Track not found' });

  return res.json({
    id:          obj.id,
    title:       obj.title,
    examDate:    obj.examDate,
    type:        obj.type        || 'theoretical',
    studyGoal:   obj.studyGoal   || '',
    description: obj.description || '',
  });
});

// ── POST /api/tracks/:id/documents ───────────────────────────────────────────

/**
 * Body: { docId: string, text: string }
 * Chunks and upserts text into the ChromaDB collection for this track.
 */
router.post('/tracks/:id/documents', async (req, res) => {
  const { docId, text } = req.body;
  if (!docId || typeof docId !== 'string') {
    return res.status(400).json({ error: 'docId is required' });
  }
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  // Verify track exists
  const data = loadProgress();
  const obj = data.objectives.find(o => o.id === req.params.id);
  if (!obj) return res.status(404).json({ error: 'Track not found' });

  try {
    const result = await rag.upsertDocument({ trackId: req.params.id, docId, text });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error('[sync] upsertDocument error:', err);
    return res.status(503).json({ error: 'Vector store unavailable: ' + err.message });
  }
});

// ── DELETE /api/tracks/:id/documents ─────────────────────────────────────────

router.delete('/tracks/:id/documents', async (req, res) => {
  try {
    await rag.deleteTrackCollection(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[sync] deleteTrackCollection error:', err);
    return res.status(503).json({ error: 'Vector store unavailable: ' + err.message });
  }
});

module.exports = router;
