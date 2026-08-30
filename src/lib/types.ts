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
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom' | 'claude-code';
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
  autoTrigger: boolean;
  suggestionCount: number;
  systemPrompt: string;
  onboardingCompleted: boolean;
}

/** Source of auth data (localStorage, sessionStorage, cookie, indexedDB) */
export interface AuthSource {
  type: 'localStorage' | 'sessionStorage' | 'cookie' | 'indexedDB';
  keys: Record<string, string>;
}

/** Aggregated auth data extracted from browser storage */
export interface AuthData {
  authenticated: boolean;
  version: 'k' | 'a' | 'unknown';
  userId?: string;
  dcId?: number;
  sources: AuthSource[];
  extractedAt: number;
  screenLocked: boolean;
  accounts: number;
}

/** Streaming port name constant */
export const STREAM_PORT_NAME = 'tg-ai-stream';

/** Callback invoked for each streaming delta; return false to abort */
export type StreamCallback = (delta: string) => void | false;

/** Streaming request message */
export interface StreamRequest {
  type: 'STREAM_REQUEST';
  payload: ChatContext;
}

/** Stream chunks over a chrome.runtime.Port */
export async function streamOverPort(
  port: chrome.runtime.Port,
  handler: (context: ChatContext, onDelta: StreamCallback) => Promise<string>,
  context: ChatContext,
): Promise<void> {
  try {
    const onDelta: StreamCallback = (delta) => {
      try {
        port.postMessage({ type: 'STREAM_DELTA', delta });
      } catch {
        return false;
      }
    };
    const full = await handler(context, onDelta);
    port.postMessage({ type: 'STREAM_DONE', text: full });
  } catch (err) {
    port.postMessage({ type: 'STREAM_ERROR', error: (err as Error).message });
  }
}

/** Messages between content script and background */
export type ExtensionMessage =
  | { type: 'GENERATE_REPLY'; payload: ChatContext }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<Settings> }
  | { type: 'AUTH_EXTRACTED'; payload: AuthData }
  | { type: 'GET_AUTH_STATUS' };
