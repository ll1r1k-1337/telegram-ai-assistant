import type { AIProvider, ChatContext } from '../types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** OpenAI models recommended for the extension */
export const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'] as const;

/**
 * OpenAI provider — calls the Chat Completions API.
 *
 * Supports GPT-4o-mini (default, cheaper) and GPT-4o (higher quality).
 * Also works with any OpenAI-compatible endpoint via custom `baseUrl`.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private systemPrompt: string;

  constructor(opts: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    systemPrompt?: string;
  }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model || DEFAULT_MODEL;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.systemPrompt = opts.systemPrompt || '';
  }

  async generateReply(context: ChatContext): Promise<string[]> {
    // Enriched context carries prompts built by reply-generator
    const enriched = context as ChatContext & {
      systemPrompt?: string;
      userPrompt?: string;
    };

    const systemPrompt =
      enriched.systemPrompt ||
      this.systemPrompt ||
      'You are a helpful assistant.';

    const userPrompt =
      enriched.userPrompt || buildFallbackPrompt(context);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OpenAIProviderError(
        `HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const text = data.choices?.[0]?.message?.content ?? '';

    if (!text.trim()) {
      throw new OpenAIProviderError('Empty response from AI');
    }

    return [text];
  }
}

/** Typed error for OpenAI provider failures */
export class OpenAIProviderError extends Error {
  readonly provider = 'openai';

  constructor(message: string) {
    super(`[openai] ${message}`);
    this.name = 'OpenAIProviderError';
  }
}

/** Minimal OpenAI Chat Completions response shape (only fields we read) */
interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** Fallback prompt when reply-generator didn't enrich the context */
function buildFallbackPrompt(context: ChatContext): string {
  const lines = context.messages.map(
    (m) => `${m.isOutgoing ? 'You' : m.author}: ${m.text}`,
  );
  return `Recent messages:\n${lines.join('\n')}\n\nSuggest a reply.`;
}

/**
 * Factory function for the provider registry.
 *
 * Used by providers/index.ts:
 *   registerProvider('openai', createOpenAIProvider);
 */
export function createOpenAIProvider(opts: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}): OpenAIProvider {
  return new OpenAIProvider(opts);
}
