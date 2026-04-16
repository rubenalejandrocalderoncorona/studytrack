'use strict';

/**
 * sandbox.service.js — Piston code execution sandbox wrapper.
 *
 * All code execution is delegated to the Piston container (PISTON_URL env,
 * default http://piston:2000).  User-submitted code MUST pass through this
 * service and never be eval'd inside the Node.js runtime.
 *
 * Supported languages are fetched from Piston at startup.  Pass the `language`
 * and `version` exactly as Piston reports them.
 */

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const PISTON_URL = process.env.PISTON_URL || 'http://piston:2000';
const EXEC_TIMEOUT_MS = 10_000; // 10 s hard cap on sandbox requests

/**
 * Simple HTTP/HTTPS fetch helper (avoids adding node-fetch as a dep).
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<{status: number, body: string}>}
 */
function _fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const body     = opts.body ? Buffer.from(opts.body, 'utf-8') : null;
    const options  = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   opts.method || 'GET',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': body ? String(body.length) : '0',
        ...(opts.headers || {}),
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end',  () => resolve({ status: res.statusCode, body: data }));
    });

    req.setTimeout(EXEC_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Piston request timed out'));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * List runtimes available in the Piston container.
 * @returns {Promise<Array<{language:string, version:string, aliases:string[]}>>}
 */
async function listRuntimes() {
  const { status, body } = await _fetch(`${PISTON_URL}/api/v2/runtimes`);
  if (status !== 200) throw new Error(`Piston /runtimes returned HTTP ${status}`);
  return JSON.parse(body);
}

/**
 * Execute code in the Piston sandbox.
 *
 * @param {object} params
 * @param {string} params.language   - Language identifier (e.g. "python", "javascript")
 * @param {string} params.version    - Runtime version (e.g. "3.10.0" — use "*" for latest)
 * @param {string} params.code       - Source code to execute
 * @param {string} [params.stdin]    - Optional stdin input
 * @returns {Promise<{stdout:string, stderr:string, exitCode:number, output:string}>}
 */
async function runCode({ language, version = '*', code, stdin = '' }) {
  /** @type {object} */
  const payload = {
    language,
    version,
    files: [{ name: `main.${_ext(language)}`, content: code }],
    stdin,
    run_timeout: 5000, // ms — Piston-side limit
  };

  const { status, body } = await _fetch(`${PISTON_URL}/api/v2/execute`, {
    method: 'POST',
    body:   JSON.stringify(payload),
  });

  if (status !== 200) {
    const msg = (() => { try { return JSON.parse(body).message; } catch { return body; } })();
    throw new Error(`Piston execution error (HTTP ${status}): ${msg}`);
  }

  const result = JSON.parse(body);
  const run    = result.run ?? {};
  return {
    stdout:   run.stdout ?? '',
    stderr:   run.stderr ?? '',
    exitCode: run.code   ?? -1,
    output:   (run.stdout ?? '') + (run.stderr ?? ''),
  };
}

/**
 * Map common language names to file extensions.
 * @param {string} lang
 * @returns {string}
 */
function _ext(lang) {
  const map = {
    python:     'py',
    javascript: 'js',
    typescript: 'ts',
    java:       'java',
    go:         'go',
    rust:       'rs',
    cpp:        'cpp',
    c:          'c',
  };
  return map[lang.toLowerCase()] ?? 'txt';
}

module.exports = { runCode, listRuntimes };
