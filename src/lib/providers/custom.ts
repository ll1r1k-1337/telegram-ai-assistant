import type { AIProvider, ChatContext } from '../types';

/**
 * Custom OpenAI-compatible endpoint provider.
 *
 * Works with any server that speaks the OpenAI `/v1/chat/completions` API:
 * LM Studio, Ollama (OpenAI compat mode), text-generation-webui,
 * Together AI, Groq, Fireworks, Azure OpenAI, etc.
 */
export class CustomProvider implements AIProvider {
  readonly name = 'custom';

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
  ) {}

  async generateReply(context: ChatContext): Promise<string[]> {
    const url = this.buildUrl();
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context);

    const body = {
      model: this.model,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ],
      temperature: 0.8,
      n: 1, // request one completion — we parse numbered variants from it
      max_tokens: 1024,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Custom endpoint error ${res.status}: ${text.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as OpenAIChatResponse;
    return this.parseVariants(data);
  }

  /** Normalize baseUrl → .../v1/chat/completions */
  private buildUrl(): string {
    let base = this.baseUrl.replace(/\/+$/, '');

    // If user gave the full path, use as-is
    if (base.endsWith('/chat/completions')) return base;

    // Strip trailing /v1 if present — we add it ourselves
    if (base.endsWith('/v1')) {
      base = base.slice(0, -3);
    }

    return `${base}/v1/chat/completions`;
  }

  private buildSystemPrompt(context: ChatContext): string {
    const chatLabel =
      context.chatType === 'private'
        ? 'личный чат'
        : context.chatType === 'group'
          ? 'групповой чат'
          : 'канал';

    return [
      'Ты — ассистент, который генерирует варианты ответа в мессенджере Telegram.',
      `Тип чата: ${chatLabel}.`,
      `Название чата: «${context.chatName}».`,
      context.language
        ? `Язык общения: ${context.language}.`
        : 'Определи язык общения из контекста и отвечай на нём.',
      'Дай ровно 3 коротких варианта ответа, каждый на отдельной строке, пронумерованных 1. 2. 3.',
      'Не добавляй пояснений — только варианты.',
    ].join('\n');
  }

  private buildUserPrompt(context: ChatContext): string {
    const lines = context.messages.map((m) => {
      const dir = m.isOutgoing ? '→' : '←';
      return `${dir} ${m.author}: ${m.text}`;
    });
    return `Контекст переписки:\n${lines.join('\n')}\n\nПредложи варианты ответа:`;
  }

  /**
   * Extract numbered suggestions from the model's response.
   * Handles both `choices[*].message.content` (multiple choices via n>1)
   * and a single response with "1. … 2. … 3. …" lines.
   */
  private parseVariants(data: OpenAIChatResponse): string[] {
    if (!data.choices?.length) {
      throw new Error('Custom endpoint returned no choices');
    }

    // If the API returned multiple choices, take each one
    if (data.choices.length > 1) {
      return data.choices.map((c) => c.message.content.trim());
    }

    // Single choice — parse numbered list
    const raw = data.choices[0].message.content.trim();
    const lines = raw.split('\n').filter((l) => l.trim());

    const variants: string[] = [];
    for (const line of lines) {
      const match = line.match(/^\d+[\.\)]\s*(.+)/);
      if (match) {
        variants.push(match[1].trim());
      }
    }

    return variants.length > 0 ? variants : [raw];
  }
}

/* ---- OpenAI chat/completions response types ---- */

interface OpenAIChatResponse {
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
