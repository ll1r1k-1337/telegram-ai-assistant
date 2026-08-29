#!/usr/bin/env node
/**
 * claude-code-proxy — Local HTTP bridge to Claude Code CLI.
 *
 * Exposes an OpenAI-compatible /v1/chat/completions endpoint on localhost.
 * Chrome extension sends requests here; the proxy spawns `claude -p` and
 * returns the result in OpenAI chat format.
 *
 * Usage:
 *   node scripts/claude-code-proxy.mjs              # default port 19280
 *   node scripts/claude-code-proxy.mjs --port 8080   # custom port
 *   node scripts/claude-code-proxy.mjs --claude /path/to/claude  # custom binary
 *
 * Requires: Claude Code CLI installed and authenticated (`claude auth login`).
 * No dependencies — uses Node.js built-in modules only.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// ── CLI args ───────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const PORT = Number(getArg('port')) || 19280;
const CLAUDE_BIN = getArg('claude') || 'claude';

// ── CORS headers (allow Chrome extension origin) ───────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Helpers ────────────────────────────────────────────

/** Build a flat prompt string from OpenAI messages array */
function messagesToPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Hello';
  }

  const parts = [];
  for (const msg of messages) {
    const role = msg.role || 'user';
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);

    if (role === 'system') {
      parts.push(`[System instructions]: ${content}`);
    } else if (role === 'assistant') {
      parts.push(`[Previous assistant reply]: ${content}`);
    } else {
      parts.push(content);
    }
  }

  return parts.join('\n\n');
}

/** Build a minimal OpenAI-compatible chat response */
function buildResponse(text, model, stream = false) {
  const id = `chatcmpl-${randomUUID().slice(0, 12)}`;
  const ts = Math.floor(Date.now() / 1000);

  if (stream) {
    return {
      id,
      object: 'chat.completion.chunk',
      created: ts,
      model: model || 'claude-code',
      choices: [{
        index: 0,
        delta: { content: text },
        finish_reason: null,
      }],
    };
  }

  return {
    id,
    object: 'chat.completion',
    created: ts,
    model: model || 'claude-code',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

/** Build an SSE stream done chunk */
function buildDoneChunk(model) {
  const id = `chatcmpl-${randomUUID().slice(0, 12)}`;
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model || 'claude-code',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  };
}

/** Run claude -p and collect full output */
function runClaude(prompt, model) {
  return new Promise((resolve, reject) => {
    const args = ['--print', prompt];
    if (model && model !== 'claude-code') {
      args.push('--model', model);
    }

    const proc = spawn(CLAUDE_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      timeout: 120_000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(
          `claude exited with code ${code}: ${stderr.trim() || stdout.trim()}`,
        ));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

/** Run claude -p with streaming — yields chunks via callback */
function runClaudeStreaming(prompt, model, onChunk, onDone, onError) {
  const cliArgs = ['--print', prompt];
  if (model && model !== 'claude-code') {
    cliArgs.push('--model', model);
  }

  const proc = spawn(CLAUDE_BIN, cliArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    timeout: 120_000,
  });

  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  proc.stdout.on('data', (chunk) => {
    onChunk(chunk.toString());
  });

  proc.on('close', (code) => {
    if (code === 0) {
      onDone();
    } else {
      onError(new Error(`claude exited ${code}: ${stderr.trim()}`));
    }
  });

  proc.on('error', (err) => {
    onError(new Error(`Failed to spawn claude: ${err.message}`));
  });

  return proc;
}

// ── Health check ───────────────────────────────────────

async function checkClaude() {
  try {
    const proc = spawn(CLAUDE_BIN, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      timeout: 10_000,
    });

    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });

    return new Promise((resolve) => {
      proc.on('close', (code) => {
        resolve(code === 0 ? out.trim() : null);
      });
      proc.on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

// ── HTTP Server ────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    const version = await checkClaude();
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: version ? 'ok' : 'error',
      proxy: 'claude-code-proxy',
      claude: version || 'not found',
    }));
    return;
  }

  // Models list (for compatibility)
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [{ id: 'claude-code', object: 'model', owned_by: 'local' }],
    }));
    return;
  }

  // Chat completions
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON body' } }));
        return;
      }

      const prompt = messagesToPrompt(parsed.messages);
      const model = parsed.model;
      const stream = parsed.stream === true;

      if (stream) {
        // SSE streaming response
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        runClaudeStreaming(
          prompt,
          model,
          (chunk) => {
            const data = buildResponse(chunk, model, true);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          },
          () => {
            const done = buildDoneChunk(model);
            res.write(`data: ${JSON.stringify(done)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          },
          (err) => {
            const errData = buildResponse(`[Error: ${err.message}]`, model, true);
            res.write(`data: ${JSON.stringify(errData)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          },
        );
      } else {
        // Non-streaming response
        try {
          const text = await runClaude(prompt, model);
          res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(JSON.stringify(buildResponse(text, model)));
        } catch (err) {
          res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: { message: err.message, type: 'proxy_error' },
          }));
        }
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

// ── Start ──────────────────────────────────────────────

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`\n  🔌 claude-code-proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`  📡 Endpoint: http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log(`  🩺 Health:   http://127.0.0.1:${PORT}/health\n`);

  const version = await checkClaude();
  if (version) {
    console.log(`  ✓ Claude Code CLI found: ${version}`);
  } else {
    console.log('  ⚠ Claude Code CLI not found — install with:');
    console.log('    npm install -g @anthropic-ai/claude-code');
    console.log('    claude auth login\n');
  }

  console.log('  Press Ctrl+C to stop.\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} is already in use.`);
    console.error(`    Try: node scripts/claude-code-proxy.mjs --port ${PORT + 1}\n`);
  } else {
    console.error(`\n  ✗ Server error: ${err.message}\n`);
  }
  process.exit(1);
});
