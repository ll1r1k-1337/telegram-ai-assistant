import type { AIProvider, ChatContext } from '../types';

const DEFAULT_PORT = 19280;

/**
 * Claude Code CLI provider — talks to the local claude-code-proxy.
 *
 * No API key needed: uses the user's Claude Code CLI auth (Pro/Max subscription).
 * Sends requests to http://127.0.0.1:PORT/v1/chat/completions in OpenAI format.
 */
export class ClaudeCodeProvider implements AIProvider {
  readonly name = 'claude-code';

  private baseUrl: string;

  constructor(opts: { baseUrl?: string }) {
    const url = opts.baseUrl?.replace(/\/+$/, '') || '';
    this.baseUrl = url || `http://127.0.0.1:${DEFAULT_PORT}`;
  }

  async generateReply(context: ChatContext): Promise<string[]> {
    // Enriched context carries prompts built by reply-generator
    const enriched = context as ChatContext & {
      systemPrompt?: string;
      userPrompt?: string;
    };

    const systemPrompt = enriched.systemPrompt || 'You are a helpful assistant.';
    const userPrompt = enriched.userPrompt || buildFallbackPrompt(context);

    const url = `${this.baseUrl}/v1/chat/completions`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-code',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 1024,
        }),
      });
    } catch (err) {
      throw new ClaudeCodeProviderError(
        `Прокси не запущен. Запустите: node scripts/claude-code-proxy.mjs — ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ClaudeCodeProviderError(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (data.error?.message) {
      throw new ClaudeCodeProviderError(data.error.message);
    }

    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      throw new ClaudeCodeProviderError('Empty response from Claude Code');
    }

    return [text];
  }
}

/** Check if the local proxy is running */
export async function checkProxyHealth(
  baseUrl?: string,
): Promise<{ ok: boolean; claude?: string; error?: string }> {
  const url = (baseUrl?.replace(/\/+$/, '') || `http://127.0.0.1:${DEFAULT_PORT}`) + '/health';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const data = (await res.json()) as { status: string; claude?: string };
    return { ok: data.status === 'ok', claude: data.claude };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Typed error for Claude Code provider failures */
export class ClaudeCodeProviderError extends Error {
  readonly provider = 'claude-code';

  constructor(message: string) {
    super(`[claude-code] ${message}`);
    this.name = 'ClaudeCodeProviderError';
  }
}

/** Fallback prompt when reply-generator didn't enrich the context */
function buildFallbackPrompt(context: ChatContext): string {
  const lines = context.messages.map((m) => `${m.isOutgoing ? 'You' : m.author}: ${m.text}`);
  return `Recent messages:\n${lines.join('\n')}\n\nSuggest a reply.`;
}

/** Factory function for provider registry */
export function createClaudeCodeProvider(opts: { baseUrl?: string }): ClaudeCodeProvider {
  return new ClaudeCodeProvider(opts);
}

/** Default proxy port */
export const CLAUDE_CODE_DEFAULT_PORT = DEFAULT_PORT;
