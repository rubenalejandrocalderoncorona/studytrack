'use strict';

/**
 * routes/exams.js — AI exam generation and grading endpoints.
 *
 * POST /api/exams/generate
 *   Generate a theoretical (Q&A) or coding (challenge) exam for an objective.
 *   Persists the generated exam to data/exams.json.
 *
 * POST /api/exams/submit
 *   Grade a submitted theoretical exam.
 *
 * GET  /api/exams/:objectiveId
 *   Retrieve all previously generated exams for an objective.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const ai      = require('../services/ai.service');
const rag     = require('../services/rag.service');

const router     = express.Router();
const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, '../data');
const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadExams() {
  if (!fs.existsSync(EXAMS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(EXAMS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveExams(data) {
  const dir = path.dirname(EXAMS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EXAMS_FILE, JSON.stringify(data, null, 2));
}

// ── POST /api/exams/generate ──────────────────────────────────────────────────

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 *
 * Body:
 *  {
 *    objectiveId: string,       -- ID of the objective/track
 *    topic:       string,       -- Specific topic within the track
 *    type:        "theoretical" | "coding",
 *    count?:      number,       -- (theoretical only) number of questions, default 5
 *    language?:   string        -- (coding only) preferred language, default "python"
 *  }
 */
router.post('/generate', async (req, res) => {
  if (!ai.isAvailable()) {
    return res.status(503).json({ error: 'AI service unavailable: ANTHROPIC_API_KEY is not configured.' });
  }

  const { objectiveId, topic, type, count, language, difficulty } = req.body;

  if (!objectiveId || typeof objectiveId !== 'string') {
    return res.status(400).json({ error: 'objectiveId is required' });
  }
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic is required' });
  }
  if (!['theoretical', 'coding'].includes(type)) {
    return res.status(400).json({ error: 'type must be "theoretical" or "coding"' });
  }

  try {
    // Pull relevant context from the vector store (best-effort)
    let context = '';
    try {
      context = await rag.queryContext({ trackId: objectiveId, query: topic, n: 5 });
    } catch (ragErr) {
      console.warn('[exams] RAG unavailable, proceeding without context:', ragErr.message);
    }

    let exam;
    if (type === 'theoretical') {
      exam = await ai.generateTheoreticalExam({ topic, count: count ?? 5, context });
    } else {
      exam = await ai.generateCodingChallenge({ topic, language: language ?? 'python', difficulty: difficulty ?? 3, context });
    }

    // Persist exam
    const exams = loadExams();
    if (!exams[objectiveId]) exams[objectiveId] = [];
    const record = {
      id:          `exam-${Date.now()}`,
      objectiveId,
      topic,
      type,
      difficulty:  type === 'coding' ? (difficulty ?? 3) : undefined,
      createdAt:   new Date().toISOString(),
      exam,
    };
    exams[objectiveId].push(record);
    saveExams(exams);

    return res.status(201).json(record);
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: err.message });
    console.error('[exams] generate error:', err);
    return res.status(500).json({ error: 'Failed to generate exam: ' + err.message });
  }
});

// ── POST /api/exams/submit ────────────────────────────────────────────────────

/**
 * Grade a theoretical exam submission.
 *
 * Body:
 *  {
 *    examId:      string,     -- The exam record id returned by /generate
 *    objectiveId: string,
 *    answers:     string[]    -- Array of answer letters, e.g. ["A","C","B","D","A"]
 *  }
 */
router.post('/submit', (req, res) => {
  const { examId, objectiveId, answers } = req.body;

  if (!examId || !objectiveId || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'examId, objectiveId, and answers[] are required' });
  }

  const exams = loadExams();
  const records = exams[objectiveId] ?? [];
  const record = records.find(r => r.id === examId);

  if (!record) return res.status(404).json({ error: 'Exam not found' });
  if (record.type !== 'theoretical') {
    return res.status(400).json({ error: 'Only theoretical exams can be submitted here; use /api/sandbox/run for coding exams' });
  }

  const result = ai.gradeTheoreticalExam(record.exam.questions, answers);
  // Stamp completion date for heatmap calendar
  record.completedAt = new Date().toISOString();
  saveExams(exams);
  return res.json({ examId, objectiveId, ...result });
});

// ── GET /api/exams/calendar/heatmap — session counts per day (all objectives) ─
// MUST be before /:objectiveId to prevent param capture

router.get('/calendar/heatmap', (req, res) => {
  const exams = loadExams();
  const counts = {};
  for (const records of Object.values(exams)) {
    for (const r of records) {
      const dateStr = (r.completedAt || (r.type === 'coding' ? r.createdAt : null));
      if (!dateStr) continue;
      const day = dateStr.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    }
  }
  return res.json(counts);
});

// ── GET /api/exams/:objectiveId ───────────────────────────────────────────────

router.get('/:objectiveId', (req, res) => {
  const exams = loadExams();
  const records = exams[req.params.objectiveId] ?? [];
  // Return summary (strip full exam body from list for performance)
  const summaries = records.map(({ id, objectiveId, topic, type, createdAt, completedAt }) => ({
    id, objectiveId, topic, type, createdAt, completedAt,
  }));
  return res.json(summaries);
});

// ── GET /api/exams/:objectiveId/:examId ───────────────────────────────────────

router.get('/:objectiveId/:examId', (req, res) => {
  const exams = loadExams();
  const records = exams[req.params.objectiveId] ?? [];
  const record = records.find(r => r.id === req.params.examId);
  if (!record) return res.status(404).json({ error: 'Exam not found' });
  return res.json(record);
});

module.exports = router;
