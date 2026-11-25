/**
 * Frontend API Client for /api/health, /api/models, and SSE /api/chat
 * Communicates strictly with the local Express server—no secrets in the browser.
 */

import { FALLBACK_MODELS } from './config.js';

export async function fetchHealth() {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      throw new Error(`Health check HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      groqKeyConfigured: false,
      error: err.message || 'Unable to reach server health endpoint.'
    };
  }
}

export async function fetchModels() {
  try {
    const res = await fetch('/api/models', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      throw new Error(`Models HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      models: Array.isArray(data.models) && data.models.length > 0 ? data.models : FALLBACK_MODELS,
      keyConfigured: Boolean(data.keyConfigured),
      defaultModel: data.defaultModel || FALLBACK_MODELS[0].id,
      setupExample: data.setupExample || '',
      warning: data.warning || null
    };
  } catch {
    return {
      models: FALLBACK_MODELS,
      keyConfigured: false,
      defaultModel: FALLBACK_MODELS[0].id,
      setupExample: '',
      warning: 'Using local fallback model catalog.'
    };
  }
}

/**
 * Streams chat tokens via Server-Sent Events from POST /api/chat.
 */
export async function streamChat({
  messages,
  model,
  temperature,
  maxTokens,
  systemPrompt,
  signal,
  onToken,
  onMeta,
  onDone
}) {
  const startedAt = performance.now();

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      maxTokens,
      systemPrompt
    }),
    signal
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const err = new Error(
      payload?.error || `Request failed with HTTP ${response.status}`
    );
    err.status = response.status;
    err.code = payload?.code || `HTTP_${response.status}`;
    err.keyMissing = Boolean(payload?.keyMissing || response.status === 401);
    err.setupExample = payload?.setupExample || '';
    throw err;
  }

  if (!response.body) {
    throw new Error('Streaming response body is unavailable in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let tokenCountEstimate = 0;
  let usageMeta = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundaryIndex;
      while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        const dataLines = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());

        if (dataLines.length === 0) continue;
        const payloadStr = dataLines.join('\n');

        if (payloadStr === '[DONE]') {
          const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
          onDone?.({
            elapsedSec,
            usage: usageMeta,
            tokenCountEstimate
          });
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(payloadStr);
        } catch {
          continue;
        }

        if (parsed.type === 'delta' && typeof parsed.content === 'string') {
          tokenCountEstimate += 1;
          onToken?.(parsed.content);
        } else if (parsed.type === 'usage' && parsed.usage) {
          usageMeta = parsed.usage;
          onMeta?.(parsed.usage);
        } else if (parsed.type === 'error') {
          const streamErr = new Error(parsed.error || 'Stream interrupted by upstream error.');
          streamErr.code = parsed.code || 'STREAM_ERROR';
          streamErr.keyMissing = Boolean(parsed.keyMissing);
          streamErr.setupExample = parsed.setupExample || '';
          throw streamErr;
        }
      }
    }

    const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
    onDone?.({
      elapsedSec,
      usage: usageMeta,
      tokenCountEstimate
    });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore lock release errors
    }
  }
}
