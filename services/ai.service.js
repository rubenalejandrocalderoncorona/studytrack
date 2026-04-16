'use strict';

/**
 * ai.service.js — Anthropic Claude integration for StudyTrack.
 *
 * Graceful degradation: if ANTHROPIC_API_KEY is absent, `isAvailable()` returns
 * false and every generator throws an AiUnavailableError.  Callers should check
 * `isAvailable()` and respond with HTTP 503 rather than letting errors propagate.
 */

const Anthropic = require('@anthropic-ai/sdk');

// ── Prompt constants ──────────────────────────────────────────────────────────

const SYSTEM_THEORETICAL = `You are an expert tutor and exam designer.
Your task is to generate a multiple-choice quiz to test theoretical understanding.
Rules:
- Return ONLY valid JSON — no markdown fences, no prose outside JSON.
- Each question has: "question" (string), "options" (array of 4 strings, labelled A–D),
  "answer" (single uppercase letter A/B/C/D), "explanation" (string, ≤ 60 words).
- Questions must be unambiguous and have exactly one correct answer.
- Vary difficulty: roughly 30% easy, 50% medium, 20% hard.`;

const SYSTEM_CODING = `You are an expert software engineering tutor and challenge designer.
Your task is to generate a coding challenge to test practical programming skills.
Rules:
- Return ONLY valid JSON — no markdown fences, no prose outside JSON.
- The object must have:
    "title": string
    "description": string (clear problem statement with input/output spec)
    "examples": array of {"input": string, "output": string, "explanation": string}
    "constraints": array of strings
    "starterCode": {"python": string, "javascript": string}  (skeleton with function signature)
    "testCases": array of {"input": string, "expectedOutput": string, "hidden": boolean}
      — include at least 3 visible and 2 hidden test cases
    "language": preferred language ("python" or "javascript")
- The challenge must be solvable within 30 minutes by a junior–mid developer.`;

// ── Client initialisation ─────────────────────────────────────────────────────

/** @type {Anthropic | null} */
let _client = null;

function _getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Returns true when the Anthropic API key is present and the client is usable.
 * @returns {boolean}
 */
function isAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

class AiUnavailableError extends Error {
  constructor() {
    super('AI service unavailable: ANTHROPIC_API_KEY is not configured.');
    this.name = 'AiUnavailableError';
    this.statusCode = 503;
  }
}

/**
 * Generate a theoretical multiple-choice exam.
 *
 * @param {object} params
 * @param {string} params.topic       - The study topic (e.g. "Vertex AI AutoML")
 * @param {number} [params.count=5]   - Number of questions (default 5, max 20)
 * @param {string} [params.context]   - Optional RAG context injected into the user message
 * @returns {Promise<{questions: Array<{question:string, options:string[], answer:string, explanation:string}>}>}
 */
async function generateTheoreticalExam({ topic, count = 5, context = '' }) {
  const client = _getClient();
  if (!client) throw new AiUnavailableError();

  const n = Math.min(Math.max(1, count), 20);
  const userMsg = [
    `Topic: ${topic}`,
    context ? `\nRelevant context from study materials:\n${context}` : '',
    `\nGenerate exactly ${n} multiple-choice questions. Return a JSON object: { "questions": [ ... ] }`,
  ].join('');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_THEORETICAL,
    messages: [{ role: 'user', content: userMsg }],
  });

  const raw = message.content[0].text.trim();
  return JSON.parse(raw);
}

/**
 * Generate a coding challenge exam.
 *
 * @param {object} params
 * @param {string} params.topic         - The coding topic (e.g. "binary search trees")
 * @param {string} [params.language]    - Preferred language hint ("python" | "javascript")
 * @param {string} [params.context]     - Optional RAG context
 * @returns {Promise<object>}           - Parsed coding challenge object
 */
async function generateCodingChallenge({ topic, language = 'python', context = '' }) {
  const client = _getClient();
  if (!client) throw new AiUnavailableError();

  const userMsg = [
    `Topic: ${topic}`,
    `Preferred language: ${language}`,
    context ? `\nRelevant context from study materials:\n${context}` : '',
    '\nGenerate one coding challenge. Return a single JSON object as specified.',
  ].join('');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_CODING,
    messages: [{ role: 'user', content: userMsg }],
  });

  const raw = message.content[0].text.trim();
  return JSON.parse(raw);
}

/**
 * Grade a submitted theoretical exam.
 * Returns a score and per-question feedback without re-calling the LLM.
 *
 * @param {Array<{question:string, options:string[], answer:string, explanation:string}>} questions
 * @param {Array<string>} answers  - User answers, e.g. ["A","C","B","D","A"]
 * @returns {{ score: number, total: number, results: Array<{correct:boolean, correctAnswer:string, explanation:string}> }}
 */
function gradeTheoreticalExam(questions, answers) {
  let score = 0;
  const results = questions.map((q, i) => {
    const correct = answers[i] === q.answer;
    if (correct) score++;
    return { correct, correctAnswer: q.answer, explanation: q.explanation };
  });
  return { score, total: questions.length, results };
}

module.exports = {
  isAvailable,
  AiUnavailableError,
  generateTheoreticalExam,
  generateCodingChallenge,
  gradeTheoreticalExam,
};
