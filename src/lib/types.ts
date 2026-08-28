/** AI Provider interface — all providers implement this */
export interface AIProvider {
  name: string;
  generateReply(context: ChatContext): Promise<string[]>;
}

/** Identifies the currently open chat (for whitelist filtering) */
export interface ChatIdentity {
  /** Numeric peer ID extracted from URL hash, e.g. "-1001234567890" */
  id: string | null;
  /** Display name extracted from the DOM header */
  name: string;
}

/** Chat context passed to AI */
export interface ChatContext {
  messages: ChatMessage[];
  chatName: string;
  chatType: 'private' | 'group' | 'channel';
  chatIdentity?: ChatIdentity;
  language?: string;
}

/** Media type detected from DOM */
export type MediaType = 'photo' | 'video' | 'sticker' | 'voice' | 'document' | 'gif' | 'audio';

/** Forward origin metadata */
export interface ForwardInfo {
  /** Original author or channel name */
  from: string;
}

/** Single chat message */
export interface ChatMessage {
  author: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
  /** Text of the message this one replies to */
  replyTo?: string;
  /** Non-null when the message was forwarded */
  forward?: ForwardInfo;
  /** True when the message has been edited */
  isEdited?: boolean;
  /** Non-null for media messages (photo, video, sticker, etc.) */
  mediaType?: MediaType;
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

/** Message sent over streaming Port to request a stream */
export interface StreamRequest {
  type: 'STREAM_REQUEST';
  payload: ChatContext;
}
