/**
 * Streaming infrastructure for AI responses.
 *
 * Bridges SSE streams from AI APIs → chrome.runtime.Port messages
 * so the content script can show tokens as they arrive.
 *
 * Architecture:
 *   Content script opens a Port → background calls streamReply →
 *   SSE chunks parsed → posted as PORT messages → content renders live.
 */

import { parseSSE, isDone } from './sse';
import type { ChatContext } from './types';

/* ---- Streaming provider interface ---- */

/**
 * Callback invoked for each text delta (token chunk).
 * Return false to abort the stream.
 */
export type StreamCallback = (delta: string) => void | false;

/**
 * Optional streaming extension for AIProvider.
 * Providers that support SSE implement this alongside generateReply.
 */
export interface StreamingCapable {
  /** true when the provider supports streaming */
  supportsStreaming: true;
  /**
   * Stream reply tokens. Calls `onDelta` for each chunk.
   * Resolves with the full concatenated text on completion.
   */
  streamReply(
    context: ChatContext,
    onDelta: StreamCallback,
  ): Promise<string>;
}

/**
 * Type guard: does provider support streaming?
 */
export function isStreamingCapable(
  provider: unknown,
): provider is StreamingCapable {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'supportsStreaming' in provider &&
    (provider as StreamingCapable).supportsStreaming === true
  );
}

/* ---- OpenAI SSE delta extractor ---- */

/** Shape of an OpenAI streaming chunk (data field parsed as JSON) */
interface OpenAIStreamChunk {
  choices: Array<{
    delta: { content?: string; role?: string };
    finish_reason: string | null;
    index: number;
  }>;
}

/**
 * Consume an OpenAI-compatible SSE stream, calling `onDelta` for each
 * content token. Returns the full concatenated response.
 *
 * Works with OpenAI, Groq, Together, LM Studio, Ollama compat, etc.
 */
export async function consumeOpenAIStream(
  response: Response,
  onDelta: StreamCallback,
): Promise<string> {
  if (!response.body) {
    throw new Error('Response has no body — streaming not supported');
  }

  let full = '';

  for await (const evt of parseSSE(response.body)) {
    if (isDone(evt)) break;

    let chunk: OpenAIStreamChunk;
    try {
      chunk = JSON.parse(evt.data) as OpenAIStreamChunk;
    } catch {
      // Non-JSON data line — skip
      continue;
    }

    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      full += delta;
      if (onDelta(delta) === false) break;
    }
  }

  return full;
}

/* ---- Port-based streaming protocol ---- */

/** Messages sent over chrome.runtime.Port for streaming */
export type StreamPortMessage =
  | { type: 'STREAM_START' }
  | { type: 'STREAM_DELTA'; delta: string }
  | { type: 'STREAM_DONE'; full: string }
  | { type: 'STREAM_ERROR'; error: string };

/** Port name used for streaming connections */
export const STREAM_PORT_NAME = 'tg-ai-stream';

/**
 * Background-side: stream an AI response over a chrome.runtime.Port.
 *
 * Usage in background service worker:
 * ```ts
 * chrome.runtime.onConnect.addListener((port) => {
 *   if (port.name === STREAM_PORT_NAME) {
 *     port.onMessage.addListener(async (msg) => {
 *       if (msg.type === 'STREAM_REQUEST') {
 *         await streamOverPort(port, provider, msg.payload);
 *       }
 *     });
 *   }
 * });
 * ```
 */
export async function streamOverPort(
  port: chrome.runtime.Port,
  streamFn: (
    context: ChatContext,
    onDelta: StreamCallback,
  ) => Promise<string>,
  context: ChatContext,
): Promise<void> {
  try {
    port.postMessage({ type: 'STREAM_START' } satisfies StreamPortMessage);

    const full = await streamFn(context, (delta) => {
      try {
        port.postMessage({
          type: 'STREAM_DELTA',
          delta,
        } satisfies StreamPortMessage);
      } catch {
        // Port disconnected — stop streaming
        return false;
      }
    });

    port.postMessage({
      type: 'STREAM_DONE',
      full,
    } satisfies StreamPortMessage);
  } catch (err) {
    try {
      port.postMessage({
        type: 'STREAM_ERROR',
        error: err instanceof Error ? err.message : String(err),
      } satisfies StreamPortMessage);
    } catch {
      // Port already disconnected — nothing to do
    }
  }
}

/**
 * Content-script side: request a streaming reply over a Port.
 *
 * Returns a controller object with callbacks. The caller sets
 * `onDelta`, `onDone`, `onError` before calling `start()`.
 */
export function createStreamClient() {
  const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });

  const client = {
    /** Called for each token chunk */
    onDelta: (_delta: string) => {},
    /** Called when streaming finishes with the full text */
    onDone: (_full: string) => {},
    /** Called on error */
    onError: (_error: string) => {},
    /** Send the stream request */
    start(context: ChatContext) {
      port.postMessage({ type: 'STREAM_REQUEST', payload: context });
    },
    /** Abort the stream */
    abort() {
      port.disconnect();
    },
  };

  port.onMessage.addListener((msg: StreamPortMessage) => {
    switch (msg.type) {
      case 'STREAM_DELTA':
        client.onDelta(msg.delta);
        break;
      case 'STREAM_DONE':
        client.onDone(msg.full);
        port.disconnect();
        break;
      case 'STREAM_ERROR':
        client.onError(msg.error);
        port.disconnect();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      client.onError(chrome.runtime.lastError.message ?? 'Port disconnected');
    }
  });

  return client;
}
