'use strict';

/**
 * routes/sandbox.js — Code execution proxy through Piston.
 *
 * POST /api/sandbox/run
 *   Execute user code in the Piston sandbox.
 *
 * GET  /api/sandbox/runtimes
 *   List available language runtimes from Piston.
 */

const express = require('express');
const sandbox = require('../services/sandbox.service');

const router = express.Router();

// ── POST /api/sandbox/run ─────────────────────────────────────────────────────

/**
 * Body:
 *  {
 *    language: string,    -- e.g. "python", "javascript"
 *    version?: string,    -- e.g. "3.10.0" (default "*" = latest)
 *    code:     string,    -- source code to execute
 *    stdin?:   string     -- optional standard input
 *  }
 *
 * Returns:
 *  { stdout: string, stderr: string, exitCode: number, output: string }
 */
router.post('/run', async (req, res) => {
  const { language, version, code, stdin } = req.body;

  if (!language || typeof language !== 'string') {
    return res.status(400).json({ error: 'language is required' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const result = await sandbox.runCode({
      language,
      version: version ?? '*',
      code,
      stdin:   stdin ?? '',
    });
    return res.json(result);
  } catch (err) {
    console.error('[sandbox] runCode error:', err);
    return res.status(503).json({ error: 'Sandbox unavailable: ' + err.message });
  }
});

// ── GET /api/sandbox/runtimes ─────────────────────────────────────────────────

router.get('/runtimes', async (req, res) => {
  try {
    const runtimes = await sandbox.listRuntimes();
    return res.json(runtimes);
  } catch (err) {
    console.error('[sandbox] listRuntimes error:', err);
    return res.status(503).json({ error: 'Sandbox unavailable: ' + err.message });
  }
});

module.exports = router;
