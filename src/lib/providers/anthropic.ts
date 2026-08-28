import type { AIProvider, ChatContext } from '../types';
import { parseSuggestions } from './openai';

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  systemPrompt?: string;
}

/**
 * Build the Anthropic Messages API body.
 */
export function buildAnthropicBody(context: ChatContext, model: string, systemPrompt?: string) {
  const system =
    systemPrompt ||
    `Ты AI-помощник в Telegram-чате «${context.chatName}» (${context.chatType}). Предлагай ответы в стиле пользователя.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const m of context.messages) {
    messages.push({
      role: m.isOutgoing ? 'assistant' : 'user',
      content: `[${m.author}]: ${m.text}`,
    });
  }

  // Anthropic requires alternating roles; collapse consecutive same-role
  const collapsed: typeof messages = [];
  for (const msg of messages) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content;
    } else {
      collapsed.push({ ...msg });
    }
  }

  // Ensure first message is 'user' (Anthropic requirement)
  if (collapsed.length === 0 || collapsed[0].role !== 'user') {
    collapsed.unshift({
      role: 'user',
      content: 'Предложи варианты ответа.',
    });
  }

  // Ensure last message is 'user'
  if (collapsed[collapsed.length - 1].role !== 'user') {
    collapsed.push({
      role: 'user',
      content: 'Предложи 3 варианта ответа на последнее сообщение.',
    });
  }

  return {
    model,
    max_tokens: 1024,
    system,
    messages: collapsed,
  };
}

export function createAnthropicProvider(cfg: AnthropicProviderConfig): AIProvider {
  return {
    name: 'anthropic',

    async generateReply(context: ChatContext): Promise<string[]> {
      const body = buildAnthropicBody(context, cfg.model, cfg.systemPrompt);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${text}`);
      }

      const json = (await res.json()) as {
        content: Array<{ type: string; text: string }>;
      };

      const raw =
        json.content
          ?.filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n') ?? '';
      return parseSuggestions(raw);
    },
  };
}
