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

/**
 * Parse AI response text into an array of suggestions.
 * Handles numbered lists (1. / 1)), dash/bullet/asterisk lists,
 * double-newline blocks, and plain text fallback.
 */
export function parseSuggestions(text: string): string[] {
  if (!text.trim()) return [text];

  const lines = text.split('\n');

  // Try numbered list (1. or 1))
  const numbered = lines
    .filter((l) => l.trim())
    .map((l) => {
      const m = l.match(/^\s*\d+[.)]\s*(.+)/);
      return m ? m[1].trim() : null;
    })
    .filter((x): x is string => x !== null);
  if (numbered.length > 0) return numbered;

  // Try dash / bullet / asterisk list
  const listItems = lines
    .filter((l) => l.trim())
    .map((l) => {
      const m = l.match(/^\s*[-•*]\s+(.+)/);
      return m ? m[1].trim() : null;
    })
    .filter((x): x is string => x !== null);
  if (listItems.length > 0) return listItems;

  // Try double-newline separated blocks
  const blocks = text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;

  // Fallback: single suggestion
  return [text.trim()];
}

/**
 * Build an OpenAI-compatible messages array from a ChatContext.
 * Used internally by the provider and exposed for testing.
 */
export function buildMessages(
  context: ChatContext,
  systemPrompt: string,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  } else {
    const chatType =
      context.chatType === 'private'
        ? 'личный чат'
        : context.chatType === 'group'
          ? 'группа'
          : 'канал';
    const lang = context.language ?? 'auto';
    messages.push({
      role: 'system',
      content: `Ты ассистент в ${chatType} «${context.chatName}». Язык: ${lang}. Предлагай ответы.`,
    });
  }

  for (const m of context.messages) {
    messages.push({
      role: m.isOutgoing ? 'assistant' : 'user',
      content: `[${m.author}]: ${m.text}`,
    });
  }

  messages.push({
    role: 'user',
    content: 'Предложи варианты ответа.',
  });

  return messages;
}
