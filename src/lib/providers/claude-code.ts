import type { AIProvider, ChatContext } from '../types';

/** Native messaging host name — must match install.py / registry entry */
const NATIVE_HOST_NAME = 'com.telegram_ai_assistant.claude_bridge';

/** Default timeout for native host responses (ms) */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Claude Code provider — bridges to the local Claude CLI via Native Messaging.
 *
 * For users with a Claude subscription (Pro/Max) who have the Claude Code CLI
 * installed locally. No API key required — authentication is handled by the
 * CLI's existing session.
 *
 * Architecture:
 *   Extension → chrome.runtime.connectNative → host.py → `claude -p` → response
 */
export class ClaudeCodeProvider implements AIProvider {
  readonly name = 'claude-code';

  private model: string;
  private systemPrompt: string;
  private timeoutMs: number;

  constructor(opts?: ClaudeCodeProviderConfig) {
    this.model = opts?.model ?? '';
    this.systemPrompt = opts?.systemPrompt ?? '';
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generateReply(context: ChatContext): Promise<string[]> {
    const enriched = context as ChatContext & {
      systemPrompt?: string;
      userPrompt?: string;
    };

    const prompt = enriched.userPrompt || this.buildPrompt(context);

    const response = await this.sendNativeMessage({
      type: 'GENERATE',
      prompt,
      model: this.model || undefined,
    });

    if (response.type === 'ERROR') {
      throw new ClaudeCodeProviderError(response.error ?? 'Unknown native host error');
    }

    const text = response.text ?? '';
    if (!text.trim()) {
      throw new ClaudeCodeProviderError('Empty response from Claude CLI');
    }

    return parseSuggestions(text);
  }

  /** Check that the native host is reachable */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendNativeMessage({ type: 'PING' });
      return response.type === 'PONG';
    } catch {
      return false;
    }
  }

  /** Build prompt from chat context when reply-generator didn't provide one */
  private buildPrompt(context: ChatContext): string {
    const chatLabel =
      context.chatType === 'private'
        ? 'личный чат'
        : context.chatType === 'group'
          ? 'групповой чат'
          : 'канал';

    const systemPart = this.systemPrompt
      ? `System: ${this.systemPrompt}\n\n`
      : '';

    const header = [
      `Ты — ассистент, который генерирует варианты ответа в Telegram.`,
      `Тип чата: ${chatLabel}. Название: «${context.chatName}».`,
      context.language
        ? `Язык общения: ${context.language}.`
        : 'Определи язык общения из контекста и отвечай на нём.',
      'Дай ровно 3 коротких варианта ответа, пронумерованных 1. 2. 3.',
      'Не добавляй пояснений — только варианты.',
    ].join('\n');

    const messages = context.messages
      .map((m) => `${m.isOutgoing ? '→' : '←'} ${m.author}: ${m.text}`)
      .join('\n');

    return `${systemPart}${header}\n\nКонтекст переписки:\n${messages}\n\nПредложи варианты ответа:`;
  }

  /**
   * Send a message to the native host and await a response.
   * Uses chrome.runtime.sendNativeMessage (one-shot, no persistent connection).
   */
  private sendNativeMessage(message: NativeRequest): Promise<NativeResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ClaudeCodeProviderError(`Native host timed out (${this.timeoutMs}ms)`));
      }, this.timeoutMs);

      try {
        chrome.runtime.sendNativeMessage(
          NATIVE_HOST_NAME,
          message,
          (response: NativeResponse) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              reject(
                new ClaudeCodeProviderError(
                  chrome.runtime.lastError.message ?? 'Native messaging failed',
                ),
              );
              return;
            }
            resolve(response);
          },
        );
      } catch (err) {
        clearTimeout(timer);
        reject(
          new ClaudeCodeProviderError(
            err instanceof Error ? err.message : String(err),
          ),
        );
      }
    });
  }
}

/** Config for ClaudeCodeProvider constructor */
export interface ClaudeCodeProviderConfig {
  /** Claude model name (optional — uses CLI default) */
  model?: string;
  /** Custom system prompt */
  systemPrompt?: string;
  /** Timeout in ms (default: 120000) */
  timeoutMs?: number;
}

/** Typed error for Claude Code provider failures */
export class ClaudeCodeProviderError extends Error {
  readonly provider = 'claude-code';

  constructor(message: string) {
    super(`[claude-code] ${message}`);
    this.name = 'ClaudeCodeProviderError';
  }
}

/**
 * Parse numbered suggestions from Claude's text output.
 * Handles "1. text\n2. text\n3. text" format.
 * Falls back to returning the full text as a single suggestion.
 */
export function parseSuggestions(text: string): string[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const variants: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*\d+[.)]\s*(.+)/);
    if (match) {
      variants.push(match[1].trim());
    }
  }

  return variants.length > 0 ? variants : [text.trim()];
}

/**
 * Factory function for the provider registry.
 */
export function createClaudeCodeProvider(
  opts?: ClaudeCodeProviderConfig,
): ClaudeCodeProvider {
  return new ClaudeCodeProvider(opts);
}

/* ---- Native messaging protocol types ---- */

type NativeRequest =
  | { type: 'PING' }
  | { type: 'GENERATE'; prompt: string; model?: string };

interface NativeResponse {
  type: 'PONG' | 'RESULT' | 'ERROR';
  text?: string;
  error?: string;
  version?: string;
}
