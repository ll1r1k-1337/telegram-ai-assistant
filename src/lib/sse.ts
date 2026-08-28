/**
 * SSE (Server-Sent Events) parser for ReadableStream<Uint8Array>.
 *
 * Parses the `text/event-stream` format used by OpenAI, Anthropic,
 * and other LLM APIs when `stream: true` is set.
 *
 * Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */

export interface SSEEvent {
  /** Event type (from `event:` line), defaults to 'message' */
  event: string;
  /** Data payload (from `data:` lines, joined by \n) */
  data: string;
  /** Optional id (from `id:` line) */
  id?: string;
}

/**
 * Async generator that yields parsed SSE events from a ReadableStream.
 *
 * Handles:
 * - Multi-line `data:` fields (joined with \n)
 * - `event:`, `id:` fields
 * - UTF-8 decoding with TextDecoder
 * - Chunks that split mid-line (buffered)
 * - `[DONE]` sentinel — emitted as a final event, caller decides to stop
 */
export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Current event being assembled
  let eventType = 'message';
  let dataLines: string[] = [];
  let eventId: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (terminated by \n or \r\n)
      const lines = buffer.split(/\r?\n/);
      // Last element is either '' (line was complete) or a partial line
      buffer = lines.pop()!;

      for (const line of lines) {
        if (line === '') {
          // Empty line = event boundary — dispatch if we have data
          if (dataLines.length > 0) {
            yield {
              event: eventType,
              data: dataLines.join('\n'),
              ...(eventId !== undefined && { id: eventId }),
            };
          }
          // Reset for next event
          eventType = 'message';
          dataLines = [];
          eventId = undefined;
          continue;
        }

        // Comment lines (start with `:`) — skip
        if (line.startsWith(':')) continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const field = line.slice(0, colonIdx);
        // Value: skip single leading space after colon per spec
        const rawValue = line.slice(colonIdx + 1);
        const value2 = rawValue.startsWith(' ')
          ? rawValue.slice(1)
          : rawValue;

        switch (field) {
          case 'data':
            dataLines.push(value2);
            break;
          case 'event':
            eventType = value2;
            break;
          case 'id':
            eventId = value2;
            break;
          // `retry:` — ignored, we don't reconnect
        }
      }
    }

    // Flush any remaining event in buffer
    if (buffer.trim()) {
      const colonIdx = buffer.indexOf(':');
      if (colonIdx !== -1) {
        const field = buffer.slice(0, colonIdx);
        const rawValue = buffer.slice(colonIdx + 1);
        const val = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
        if (field === 'data') dataLines.push(val);
      }
    }
    if (dataLines.length > 0) {
      yield {
        event: eventType,
        data: dataLines.join('\n'),
        ...(eventId !== undefined && { id: eventId }),
      };
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Check if an SSE event is the OpenAI `[DONE]` sentinel.
 */
export function isDone(evt: SSEEvent): boolean {
  return evt.data.trim() === '[DONE]';
}
