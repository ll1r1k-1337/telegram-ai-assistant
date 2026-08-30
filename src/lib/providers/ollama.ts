import type { AIProvider, ChatContext } from '../types';
import { parseSuggestions } from './claude-code';

export interface OllamaProviderConfig {
  model: string;
  baseUrl?: string;
  systemPrompt?: string;
}

export function createOllamaProvider(cfg: OllamaProviderConfig): AIProvider {
  const baseUrl = (cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '');

  return {
    name: 'ollama',

    async generateReply(context: ChatContext): Promise<string[]> {
      const system =
        cfg.systemPrompt ||
        `Ты AI-помощник в Telegram. Чат: ${context.chatName} (${context.chatType}). Предлагай ответы.`;

      const prompt = context.messages.map((m) => `[${m.author}]: ${m.text}`).join('\n');

      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model,
          system,
          prompt: prompt + '\n\nПредложи 3 варианта ответа.',
          stream: false,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama API error ${res.status}: ${text}`);
      }

      const json = (await res.json()) as { response: string };
      return parseSuggestions(json.response ?? '');
    },
  };
}
