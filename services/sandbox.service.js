'use strict';

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const PISTON_URL      = process.env.PISTON_URL || 'http://localhost:2000';
const EXEC_TIMEOUT_MS = 10_000;
const INSTALL_TIMEOUT_MS = 120_000;

// Cache of language → version for installed runtimes (populated lazily)
let _runtimeCache = null;
// Track in-progress installs so concurrent requests don't double-install
const _installing = new Map();

function _fetch(url, opts = {}, timeoutMs = EXEC_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed    = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const body      = opts.body ? Buffer.from(opts.body, 'utf-8') : null;
    const options   = {
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

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Piston request timed out'));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function listRuntimes() {
  const { status, body } = await _fetch(`${PISTON_URL}/api/v2/runtimes`);
  if (status !== 200) throw new Error(`Piston /runtimes returned HTTP ${status}`);
  const runtimes = JSON.parse(body);
  // Refresh cache
  _runtimeCache = new Map();
  for (const r of runtimes) {
    _runtimeCache.set(r.language.toLowerCase(), r.version);
    for (const alias of (r.aliases || [])) {
      _runtimeCache.set(alias.toLowerCase(), r.version);
    }
  }
  return runtimes;
}

/**
 * Ensure a language runtime is installed in Piston.
 * If not installed, fetches the available packages list and installs the latest version.
 * Concurrent calls for the same language wait on the same install promise.
 */
async function ensureRuntime(language) {
  const lang = language.toLowerCase();

  // Populate cache if empty
  if (!_runtimeCache) await listRuntimes();

  if (_runtimeCache.has(lang)) return _runtimeCache.get(lang);

  // Already being installed — wait for it
  if (_installing.has(lang)) return _installing.get(lang);

  const installPromise = (async () => {
    console.log(`[sandbox] runtime "${lang}" not installed — fetching available packages…`);

    // Get available packages from Piston
    const { status: ps, body: pb } = await _fetch(`${PISTON_URL}/api/v2/packages`);
    if (ps !== 200) throw new Error(`Piston /packages returned HTTP ${ps}`);
    const packages = JSON.parse(pb);

    // Find the latest version for this language (or alias)
    const match = packages
      .filter(p => p.language.toLowerCase() === lang || (p.aliases || []).some(a => a.toLowerCase() === lang))
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];

    if (!match) throw new Error(`Language "${language}" is not available in this Piston instance`);

    console.log(`[sandbox] installing ${match.language} ${match.version}…`);
    const { status: is } = await _fetch(`${PISTON_URL}/api/v2/packages`, {
      method: 'POST',
      body: JSON.stringify({ language: match.language, version: match.version }),
    }, INSTALL_TIMEOUT_MS);

    if (is !== 200) throw new Error(`Failed to install ${match.language} ${match.version}`);

    // Refresh cache after install
    await listRuntimes();
    console.log(`[sandbox] installed ${match.language} ${match.version}`);
    return match.version;
  })();

  _installing.set(lang, installPromise);
  try {
    const version = await installPromise;
    return version;
  } finally {
    _installing.delete(lang);
  }
}

async function runCode({ language, version = '*', code, stdin = '' }) {
  // Auto-install runtime if needed (resolves version too)
  const resolvedVersion = await ensureRuntime(language);

  const payload = {
    language,
    version: version !== '*' ? version : resolvedVersion,
    files: [{ name: `main.${_ext(language)}`, content: code }],
    stdin,
    run_timeout: 5000,
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

function _ext(lang) {
  const map = {
    python: 'py', javascript: 'js', typescript: 'ts',
    java: 'java', go: 'go', rust: 'rs', cpp: 'cpp', c: 'c',
    ruby: 'rb', php: 'php', bash: 'sh',
  };
  return map[lang.toLowerCase()] ?? 'txt';
}

module.exports = { runCode, listRuntimes, ensureRuntime };
