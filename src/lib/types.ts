/** AI Provider interface — all providers implement this */
export interface AIProvider {
  name: string;
  generateReply(context: ChatContext): Promise<string[]>;
}

/** Chat context passed to AI */
export interface ChatContext {
  messages: ChatMessage[];
  chatName: string;
  chatType: 'private' | 'group' | 'channel';
  language?: string;
}

/** Single chat message */
export interface ChatMessage {
  author: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
  replyTo?: string;
}

/** Suggestion count limits */
export const MIN_SUGGESTION_COUNT = 1;
export const MAX_SUGGESTION_COUNT = 5;
export const DEFAULT_SUGGESTION_COUNT = 3;

/** Clamp suggestionCount to valid 1-5 range */
export function clampSuggestionCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SUGGESTION_COUNT;
  return Math.max(MIN_SUGGESTION_COUNT, Math.min(MAX_SUGGESTION_COUNT, Math.round(n)));
}

/** Extension settings stored in chrome.storage */
export interface Settings {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
  autoTrigger: boolean;
  suggestionCount: number;
  systemPrompt: string;
}

/** Messages between content script and background */
export type ExtensionMessage =
  | { type: 'GENERATE_REPLY'; payload: ChatContext }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<Settings> };
