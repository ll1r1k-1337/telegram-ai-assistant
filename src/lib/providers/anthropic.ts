import type { AIProvider, ChatContext } from '../types';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Anthropic models recommended for the extension */
export const ANTHROPIC_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250414',
] as const;

/**
 * Anthropic (Claude) provider — calls the Messages API.
 *
 * Supports Claude Sonnet 4 (default, balanced) and Claude Haiku 4 (fast, cheap).
 * Uses the `anthropic-dangerous-direct-browser-access` header required
 * for direct browser calls from Chrome extensions.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  private apiKey: string;
  private model: string;
  private systemPrompt: string;

  constructor(opts: { apiKey: string; model?: string; systemPrompt?: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model || DEFAULT_MODEL;
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

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        // Required for direct browser calls (Chrome extension context)
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        // Anthropic: system prompt is a top-level field, not a message
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 1024,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AnthropicProviderError(
        `HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as AnthropicMessagesResponse;

    // Anthropic returns content blocks — concatenate all text blocks
    const text =
      data.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n') ?? '';

    if (!text.trim()) {
      throw new AnthropicProviderError('Empty response from AI');
    }

    return [text];
  }
}

/** Typed error for Anthropic provider failures */
export class AnthropicProviderError extends Error {
  readonly provider = 'anthropic';

  constructor(message: string) {
    super(`[anthropic] ${message}`);
    this.name = 'AnthropicProviderError';
  }
}

/** Minimal Anthropic Messages API response shape (only fields we read) */
interface AnthropicMessagesResponse {
  content?: { type: string; text: string }[];
  stop_reason?: string;
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
 */
export function createAnthropicProvider(opts: {
  apiKey: string;
  model?: string;
}): AnthropicProvider {
  return new AnthropicProvider(opts);
}

/**
 * Build an Anthropic Messages API request body from a ChatContext.
 * Exposed for testing. Handles role alternation (Anthropic requires it).
 */
export function buildAnthropicBody(
  context: ChatContext,
  model: string,
  systemPrompt?: string,
): {
  system: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens: number;
} {
  const system =
    systemPrompt || `Ты ассистент в чате «${context.chatName}». Предлагай ответы.`;

  const raw: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of context.messages) {
    raw.push({
      role: m.isOutgoing ? 'assistant' : 'user',
      content: `[${m.author}]: ${m.text}`,
    });
  }
  raw.push({ role: 'user', content: 'Предложи варианты ответа.' });

  // Collapse consecutive same-role messages (Anthropic requires alternation)
  const messages: Array<{ role: string; content: string }> = [];
  for (const m of raw) {
    if (messages.length > 0 && messages[messages.length - 1].role === m.role) {
      messages[messages.length - 1].content += '\n' + m.content;
    } else {
      messages.push({ ...m });
    }
  }

  // Ensure first message is user
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: 'Предложи ответ.' });
  }

  return { system, model, messages, max_tokens: 1024 };
}
