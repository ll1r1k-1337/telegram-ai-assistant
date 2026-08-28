import type { ChatMessage } from '../types';

/**
 * Selectors for Telegram Web K-version DOM elements.
 *
 * K-version (web.telegram.org/k/) wraps every message in a `.bubble`
 * inside `.bubbles-inner`.  The A-version uses similar `.message`
 * wrappers — we query both so the parser works on either.
 */
const SEL = {
  /** Container that holds all message bubbles */
  messagesContainer:
    '.bubbles-inner, .messages-container, #column-center .bubbles',
  /** A single message bubble */
  bubble: '.bubble:not(.is-date):not(.service)',
  /** Text content inside a bubble */
  text: '.message .text-content, .text-content, .message-text, .message',
  /** Author name element */
  author: '.peer-title, .name-peer, .message-author, .name',
  /** Timestamp element */
  time: '.time .i18n, .time, time, .message-time',
  /** Reply block inside a bubble */
  reply: '.reply, .reply-markup',
} as const;

/**
 * Extract the visible text from a message bubble.
 * Returns empty string for media-only messages (filtered out upstream).
 */
export function extractMessageText(el: Element): string {
  const textEl = el.querySelector(SEL.text);
  if (!textEl) return '';
  return (textEl.textContent ?? '').trim();
}

/**
 * Check whether a message bubble is outgoing (sent by the user).
 *
 * K-version marks outgoing bubbles with `.is-out`.
 */
export function isOutgoingMessage(el: Element): boolean {
  return (
    el.classList.contains('is-out') ||
    el.closest('.bubble')?.classList.contains('is-out') === true
  );
}

/**
 * Extract the author name from a message bubble.
 *
 * In private chats, outgoing messages rarely show an author element —
 * we fall back to «Вы» (You) for those.
 */
export function extractAuthor(el: Element): string {
  const nameEl = el.querySelector(SEL.author);
  if (nameEl) {
    const name = (nameEl.textContent ?? '').trim();
    if (name) return name;
  }

  if (isOutgoingMessage(el)) return 'Вы';
  return 'Unknown';
}

/**
 * Extract a human-readable timestamp from a message element.
 *
 * Prefers the `datetime` attribute on `<time>` tags; falls back
 * to visible text (e.g. "14:32").
 */
export function extractTimestamp(el: Element): string {
  const timeEl = el.querySelector(SEL.time);
  if (!timeEl) return '';

  return (
    timeEl.getAttribute('datetime') ??
    (timeEl.textContent ?? '').trim()
  );
}

/**
 * Extract the reply-to text from a message, if any.
 */
export function extractReplyTo(el: Element): string | undefined {
  const replyEl = el.querySelector(SEL.reply);
  if (!replyEl) return undefined;
  const text = (replyEl.textContent ?? '').trim();
  return text || undefined;
}

/**
 * Parse a single message DOM element into a `ChatMessage`.
 * Returns `null` for non-text messages (media-only, service, etc.).
 */
export function parseMessageElement(el: Element): ChatMessage | null {
  const text = extractMessageText(el);
  if (!text) return null;

  return {
    author: extractAuthor(el),
    text,
    timestamp: extractTimestamp(el),
    isOutgoing: isOutgoingMessage(el),
    replyTo: extractReplyTo(el),
  };
}

/**
 * Find all message bubble elements inside a container.
 */
export function findBubbles(container: Element): Element[] {
  return Array.from(container.querySelectorAll(SEL.bubble));
}

/**
 * Find the messages container element in the current page.
 * Returns `null` if Telegram's chat view is not open.
 */
export function findMessagesContainer(): Element | null {
  return document.querySelector(SEL.messagesContainer);
}

/**
 * Extract the last N messages from the DOM.
 *
 * This is the main entry point for E3-002.
 *
 * @param n  Maximum number of messages to return (default 15).
 *           Clamped to [1, 50] to prevent accidental over-reads.
 * @param container  Optional — pass a specific container element
 *                   (useful for testing).  Defaults to auto-detected.
 * @returns  Array of `ChatMessage` objects, ordered chronologically
 *           (oldest first), with at most `n` entries.
 */
export function getLastMessages(
  n = 15,
  container?: Element | null,
): ChatMessage[] {
  const safeN = Math.max(1, Math.min(50, Math.round(n)));

  const root = container ?? findMessagesContainer();
  if (!root) return [];

  const bubbles = findBubbles(root);

  // Parse all bubbles, filtering out non-text ones
  const parsed: ChatMessage[] = [];
  for (const bubble of bubbles) {
    const msg = parseMessageElement(bubble);
    if (msg) parsed.push(msg);
  }

  // Return only the last N (chronological order preserved)
  return parsed.slice(-safeN);
}
