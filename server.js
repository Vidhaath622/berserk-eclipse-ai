/**
 * Berserk Personal AI Chatbot — Node.js + Express Backend
 * Safely loads GROQ_API_KEY from .env on the server, proxies Groq API calls via SSE,
 * and serves local frontend + verified vendor ES modules for 100% offline-ready assets.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env directly while preserving non-empty CLI overrides (e.g. PORT=4000 npm start)
const dotenvResult = dotenv.config({ path: path.join(__dirname, '.env') });
if (dotenvResult.parsed) {
  for (const [k, v] of Object.entries(dotenvResult.parsed)) {
    if (!process.env[k] && v) {
      process.env[k] = v;
    }
  }
}

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const ENV_SETUP_EXAMPLE = 'GROQ_API_KEY=gsk_your_groq_api_key_here';

const FALLBACK_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', contextWindow: 131072 },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', contextWindow: 131072 },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (32k)', contextWindow: 32768 },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B IT', contextWindow: 8192 }
];

function getGroqApiKey() {
  const raw = (process.env.GROQ_API_KEY || '').trim();
  if (!raw || raw === 'your_api_key_here' || raw === 'gsk_...') {
    return '';
  }
  return raw;
}

function getDefaultModel() {
  return (process.env.GROQ_DEFAULT_MODEL || '').trim() || 'llama-3.3-70b-versatile';
}

function formatModelLabel(id) {
  const known = FALLBACK_MODELS.find((m) => m.id === id);
  if (known) return known.label;
  return id
    .replace(/[-_/]/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function isChatCapableModel(modelObj) {
  if (!modelObj || typeof modelObj.id !== 'string') return false;
  if (modelObj.active === false) return false;
  const id = modelObj.id.toLowerCase();
  // Exclude speech-to-text, text-to-speech, guard/moderation classifiers, and embedding models
  if (
    id.includes('whisper') ||
    id.includes('tts') ||
    id.includes('playai') ||
    id.includes('orpheus') ||
    id.includes('guard') ||
    id.includes('safeguard') ||
    id.includes('embed')
  ) {
    return false;
  }
  return true;
}

// Middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Verified local /vendor/* mounts from node_modules
const vendorMounts = [
  { route: '/vendor/three', dir: path.join(__dirname, 'node_modules/three/build') },
  { route: '/vendor/marked', dir: path.join(__dirname, 'node_modules/marked/lib') },
  { route: '/vendor/hljs', dir: path.join(__dirname, 'node_modules/@highlightjs/cdn-assets') }
];

for (const mount of vendorMounts) {
  if (!fs.existsSync(mount.dir)) {
    console.warn(`[WARN] Vendor asset path missing: ${mount.dir}. Run "npm install" first.`);
  }
  app.use(
    mount.route,
    express.static(mount.dir, {
      immutable: false,
      maxAge: '1h'
    })
  );
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/health
 * Lightweight readiness & .env key configuration check (never exposes the key).
 */
app.get('/api/health', (_req, res) => {
  const groqKeyConfigured = Boolean(getGroqApiKey());
  res.json({
    ok: true,
    groqKeyConfigured,
    defaultModel: getDefaultModel(),
    setupExample: ENV_SETUP_EXAMPLE
  });
});

/**
 * GET /api/models
 * Queries Groq /openai/v1/models and filters active text/chat models.
 * Falls back gracefully when GROQ_API_KEY is missing or unreachable.
 */
app.get('/api/models', async (_req, res) => {
  const apiKey = getGroqApiKey();
  const defaultModel = getDefaultModel();

  if (!apiKey) {
    return res.json({
      models: FALLBACK_MODELS,
      keyConfigured: false,
      defaultModel,
      setupExample: ENV_SETUP_EXAMPLE
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(`${GROQ_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (upstream.status === 401 || upstream.status === 403) {
      return res.json({
        models: FALLBACK_MODELS,
        keyConfigured: false,
        defaultModel,
        setupExample: ENV_SETUP_EXAMPLE,
        warning: 'Groq rejected the configured API key (401 Unauthorized).'
      });
    }

    if (!upstream.ok) {
      return res.json({
        models: FALLBACK_MODELS,
        keyConfigured: true,
        defaultModel,
        warning: `Using fallback model list (Groq models endpoint HTTP ${upstream.status}).`
      });
    }

    const body = await upstream.json();
    const rawList = Array.isArray(body?.data) ? body.data : [];

    const filtered = rawList
      .filter(isChatCapableModel)
      .map((m) => ({
        id: m.id,
        label: formatModelLabel(m.id),
        contextWindow: m.context_window || null,
        ownedBy: m.owned_by || ''
      }));

    // Sort with default model first, then flagship Llama / Qwen / DeepSeek / Mixtral / Gemma, then alphabetical
    const priorityScore = (id) => {
      if (id === defaultModel) return 0;
      if (id.startsWith('llama-3.3-70b')) return 1;
      if (id.startsWith('llama-3.1-8b')) return 2;
      if (id.includes('llama')) return 3;
      if (id.includes('qwen') || id.includes('deepseek')) return 4;
      if (id.includes('mixtral') || id.includes('gemma')) return 5;
      return 6;
    };

    filtered.sort((a, b) => {
      const diff = priorityScore(a.id) - priorityScore(b.id);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    return res.json({
      models: filtered.length > 0 ? filtered : FALLBACK_MODELS,
      keyConfigured: true,
      defaultModel
    });
  } catch (err) {
    return res.json({
      models: FALLBACK_MODELS,
      keyConfigured: true,
      defaultModel,
      warning: `Could not reach Groq model catalog (${err.name === 'AbortError' ? 'timeout' : 'network error'}); showing fallback models.`
    });
  } finally {
    clearTimeout(timeout);
  }
});

/**
 * POST /api/chat
 * Streams Groq chat completions back to the browser via Server-Sent Events (SSE).
 */
app.post('/api/chat', async (req, res) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return res.status(401).json({
      error:
        'Astral Seal Unbound — Your Groq API key is missing in .env. Paste your key into .env and restart the server.',
      code: 'MISSING_API_KEY',
      keyMissing: true,
      setupExample: ENV_SETUP_EXAMPLE
    });
  }

  const { messages, model, temperature, maxTokens, systemPrompt } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Invalid request: messages must be a non-empty array.',
      code: 'INVALID_MESSAGES'
    });
  }

  const sanitizedMessages = [];
  if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
    sanitizedMessages.push({
      role: 'system',
      content: systemPrompt.trim().slice(0, 16000)
    });
  }

  for (const item of messages) {
    if (
      item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0
    ) {
      sanitizedMessages.push({
        role: item.role,
        content: item.content
      });
    }
  }

  if (sanitizedMessages.filter((m) => m.role === 'user').length === 0) {
    return res.status(400).json({
      error: 'At least one non-empty user message is required.',
      code: 'EMPTY_USER_PROMPT'
    });
  }

  const targetModel =
    typeof model === 'string' && model.trim() ? model.trim() : getDefaultModel();
  const safeTemp = Number.isFinite(Number(temperature))
    ? Math.min(1.5, Math.max(0, Number(temperature)))
    : 0.7;
  const safeMaxTokens = Number.isFinite(Number(maxTokens))
    ? Math.min(8192, Math.max(256, Math.round(Number(maxTokens))))
    : 4096;

  // Abort upstream Groq stream immediately if client disconnects or clicks Stop
  const upstreamAbort = new AbortController();
  let clientDisconnected = false;

  const handleClose = () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
      upstreamAbort.abort();
    }
  };
  req.on('aborted', handleClose);
  res.on('close', handleClose);

  try {
    const upstream = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify({
        model: targetModel,
        messages: sanitizedMessages,
        temperature: safeTemp,
        max_tokens: safeMaxTokens,
        stream: true
      }),
      signal: upstreamAbort.signal
    });

    if (!upstream.ok) {
      let errMessage = `Groq API returned HTTP ${upstream.status}.`;
      try {
        const errJson = await upstream.json();
        if (errJson?.error?.message) {
          errMessage = errJson.error.message;
        }
      } catch {
        // ignore JSON parse failure on error body
      }

      if (upstream.status === 401 || upstream.status === 403) {
        return res.status(401).json({
          error: `Astral Seal Rejected (401) — ${errMessage} Verify your key in .env and restart the server.`,
          code: 'INVALID_API_KEY',
          keyMissing: true,
          setupExample: ENV_SETUP_EXAMPLE
        });
      }

      if (upstream.status === 429) {
        return res.status(429).json({
          error: `Groq rate limit reached: ${errMessage}`,
          code: 'RATE_LIMITED'
        });
      }

      const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      return res.status(status).json({
        error: errMessage,
        code: 'UPSTREAM_ERROR'
      });
    }

    if (!upstream.body) {
      return res.status(502).json({
        error: 'Groq upstream returned an empty stream body.',
        code: 'EMPTY_STREAM'
      });
    }

    // Begin SSE response
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (!clientDisconnected) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();

        if (dataStr === '[DONE]') {
          if (!res.writableEnded) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
          return;
        }

        let chunk;
        try {
          chunk = JSON.parse(dataStr);
        } catch {
          continue;
        }

        const delta = chunk?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0 && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
        }

        const usage = chunk?.x_groq?.usage || chunk?.usage;
        if (usage && !res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              type: 'usage',
              usage: {
                promptTokens: usage.prompt_tokens ?? null,
                completionTokens: usage.completion_tokens ?? null,
                totalTokens: usage.total_tokens ?? null,
                completionTime: usage.completion_time ?? null
              }
            })}\n\n`
          );
        }
      }
    }

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    if (clientDisconnected || err?.name === 'AbortError') {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    console.error('[POST /api/chat] Error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to connect to Groq API. Check your internet connection and server logs.',
        code: 'INTERNAL_NETWORK_ERROR'
      });
    }

    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: 'Connection interrupted while streaming response.',
          code: 'STREAM_ABORTED'
        })}\n\n`
      );
      res.end();
    }
  }
});

// Fallback for unknown /api/* or missing static /vendor/*, /js/*, /css/* assets
app.use(['/api', '/vendor', '/js', '/css'], (_req, res) => {
  res.status(404).json({ error: 'Requested resource not found.' });
});

// SPA fallback to index.html for non-asset routes
app.get('*', (_req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).json({ error: 'Not found.' });
});

// Listen on local port when running outside Vercel's serverless runtime
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const hasKey = Boolean(getGroqApiKey());
    console.log(`\n⚔  Eclipse AI Server awakened at http://localhost:${PORT}`);
    console.log(
      `   Groq API Key (.env): ${hasKey ? 'Configured ✓' : 'Not set — waiting for key in .env'}`
    );
    console.log(`   Default Model:       ${getDefaultModel()}\n`);
  });
}

export default app;
