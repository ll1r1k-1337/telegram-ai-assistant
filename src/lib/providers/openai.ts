import type { AIProvider, ChatContext } from '../types';

/**
 * Build the messages array for an OpenAI-compatible chat completion request.
 */
export function buildMessages(
  context: ChatContext,
  systemPrompt: string,
): Array<{ role: string; content: string }> {
  const sysContent = systemPrompt || defaultSystemPrompt(context);
  const msgs: Array<{ role: string; content: string }> = [{ role: 'system', content: sysContent }];

  for (const m of context.messages) {
    msgs.push({
      role: m.isOutgoing ? 'assistant' : 'user',
      content: `[${m.author}]: ${m.text}`,
    });
  }

  msgs.push({
    role: 'user',
    content: 'Предложи 3 варианта ответа на последнее сообщение.',
  });

  return msgs;
}

function defaultSystemPrompt(ctx: ChatContext): string {
  const chatLabel =
    ctx.chatType === 'private'
      ? `личный чат с ${ctx.chatName}`
      : ctx.chatType === 'group'
        ? `группа «${ctx.chatName}»`
        : `канал «${ctx.chatName}»`;
  return `Ты AI-помощник в Telegram. Контекст: ${chatLabel}. Предлагай ответы в стиле пользователя. Язык: ${ctx.language ?? 'auto'}.`;
}

/**
 * Parse the AI response text into separate suggestions.
 * Supports numbered lists (1. / 1) ), dash/bullet lists, and double-newline blocks.
 */
export function parseSuggestions(raw: string): string[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Try numbered list: "1. text" or "1) text"
  const numbered = lines
    .map((l) => l.match(/^\d+[.)]\s+(.+)$/))
    .filter(Boolean)
    .map((m) => m![1].trim());
  if (numbered.length >= 2) return numbered;

  // Try bullet/dash list: "- text" or "• text" or "* text"
  const bulleted = lines
    .map((l) => l.match(/^[-•*]\s+(.+)$/))
    .filter(Boolean)
    .map((m) => m![1].trim());
  if (bulleted.length >= 2) return bulleted;

  // Fall back: split by double newline
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length >= 2) return blocks;

  // Single block — return as-is
  return [raw.trim()];
}

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  systemPrompt?: string;
}

export function createOpenAIProvider(cfg: OpenAIProviderConfig): AIProvider {
  const baseUrl = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');

  return {
    name: 'openai',

    async generateReply(context: ChatContext): Promise<string[]> {
      const messages = buildMessages(context, cfg.systemPrompt ?? '');

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({ model: cfg.model, messages }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${body}`);
      }

      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const raw = json.choices?.[0]?.message?.content ?? '';
      return parseSuggestions(raw);
    },
  };
}
