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
  onboardingCompleted: boolean;
}

/** Messages between content script and background */
export type ExtensionMessage =
  | { type: 'GENERATE_REPLY'; payload: ChatContext }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<Settings> };
