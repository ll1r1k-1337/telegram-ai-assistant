import type { ChatContext, ChatMessage, ForwardInfo, MediaType } from '@/lib/types';

/* --- Message-level helpers --- */

/** Extract text content from a message element. */
export function extractMessageText(el: Element): string {
  const selectors = ['.text-content', '.message-text', '.message', '.caption'];
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    if (node?.textContent?.trim()) return node.textContent.trim();
  }
  return '';
}

/** Check if a message element is outgoing (sent by the user). */
export function isOutgoingMessage(el: Element): boolean {
  return el.classList.contains('is-out') || el.classList.contains('message-out');
}

/** Extract author name from a message element. */
export function extractAuthor(el: Element): string {
  const peerTitle = el.querySelector('.peer-title');
  if (peerTitle?.textContent?.trim()) return peerTitle.textContent.trim();

  const name = el.querySelector('.name');
  if (name?.textContent?.trim()) return name.textContent.trim();

  if (isOutgoingMessage(el)) return 'Вы';
  return 'Unknown';
}

/** Extract timestamp from a message element. */
export function extractTimestamp(el: Element): string {
  const time = el.querySelector('time');
  if (time) {
    const dt = time.getAttribute('datetime');
    if (dt) return dt;
    if (time.textContent?.trim()) return time.textContent.trim();
  }

  const timeInner = el.querySelector('.time-inner');
  if (timeInner?.textContent?.trim()) return timeInner.textContent.trim();

  const timeSpan = el.querySelector('.time');
  if (timeSpan?.textContent?.trim()) return timeSpan.textContent.trim();

  return '';
}

/** Extract reply-to text from a message element. */
export function extractReplyTo(el: Element): string | undefined {
  const reply = el.querySelector('.reply');
  if (!reply) return undefined;

  // Prefer specific sub-selectors
  const subtitle = reply.querySelector('.reply-subtitle');
  if (subtitle?.textContent?.trim()) return subtitle.textContent.trim();

  const content = reply.querySelector('.reply-content');
  if (content?.textContent?.trim()) return content.textContent.trim();

  // Fallback to entire reply block text
  const text = reply.textContent?.trim();
  return text || undefined;
}

/** Extract forward info from a message element. */
export function extractForwardInfo(el: Element): ForwardInfo | undefined {
  const fwd = el.querySelector('.forward') || el.querySelector('.forwarded-header');
  if (!fwd) return undefined;

  // Try peer-title inside the forward block
  const peerTitle = fwd.querySelector('.peer-title');
  if (peerTitle?.textContent?.trim()) {
    return { from: peerTitle.textContent.trim() };
  }

  // Fallback to raw text, stripping common prefixes
  let text = fwd.textContent?.trim() ?? '';
  text = text.replace(/^Forwarded from\s+/i, '');
  text = text.replace(/^Переслано от\s+/i, '');
  return text ? { from: text } : undefined;
}

/** Check if a message has been edited. */
export function isEditedMessage(el: Element): boolean {
  if (el.querySelector('.edited')) return true;

  const timeEl = el.querySelector('.time');
  if (timeEl?.textContent) {
    const t = timeEl.textContent.toLowerCase();
    if (t.includes('edited') || t.includes('ред.')) return true;
  }
  return false;
}

/** Detect media type from a message element. */
export function detectMediaType(el: Element): MediaType | undefined {
  const mediaMap: [string, MediaType][] = [
    ['.media-photo', 'photo'],
    ['.media-video', 'video'],
    ['.media-sticker', 'sticker'],
    ['.sticker-container', 'sticker'],
    ['.media-voice', 'voice'],
    ['.document', 'document'],
    ['.gif', 'gif'],
    ['.audio', 'audio'],
  ];

  for (const [selector, type] of mediaMap) {
    if (el.querySelector(selector)) return type;
  }
  return undefined;
}

/* --- Composite parsers --- */

/** Parse a single message DOM element into a ChatMessage, or null if no text/media. */
export function parseMessageElement(el: Element): ChatMessage | null {
  const mediaType = detectMediaType(el);
  let text = extractMessageText(el);

  // For media-only messages, use placeholder text
  if (!text && mediaType) {
    text = `[${mediaType}]`;
  }

  if (!text) return null;

  const msg: ChatMessage = {
    author: extractAuthor(el),
    text,
    timestamp: extractTimestamp(el),
    isOutgoing: isOutgoingMessage(el),
    replyTo: extractReplyTo(el),
  };

  const forward = extractForwardInfo(el);
  if (forward) msg.forward = forward;

  if (isEditedMessage(el)) msg.isEdited = true;

  if (mediaType) msg.mediaType = mediaType;

  return msg;
}

/** Parse all message elements inside a container. */
export function parseMessages(container: Element): ChatMessage[] {
  const nodes = container.querySelectorAll('.message, .bubble');
  const messages: ChatMessage[] = [];

  for (const node of nodes) {
    const msg = parseMessageElement(node);
    if (msg) messages.push(msg);
  }
  return messages;
}

/* --- Chat context --- */

/** Detect chat type from the messages container. */
export function detectChatType(container: Element): 'private' | 'group' | 'channel' {
  if (container.querySelector('.is-channel')) return 'channel';

  const authors = new Set<string>();
  const peerTitles = container.querySelectorAll('.peer-title');
  for (const pt of peerTitles) {
    const name = pt.textContent?.trim();
    if (name) authors.add(name);
  }

  if (authors.size >= 2) return 'group';
  return 'private';
}

/** Extract chat name from a header element. */
export function extractChatName(header: Element): string {
  const peerTitle = header.querySelector('.peer-title');
  if (peerTitle?.textContent?.trim()) return peerTitle.textContent.trim();

  const h3 = header.querySelector('h3');
  if (h3?.textContent?.trim()) return h3.textContent.trim();

  return 'Unknown Chat';
}

/** Build a complete ChatContext from DOM elements. */
export function buildChatContext(messagesContainer: Element, headerElement: Element): ChatContext {
  return {
    chatName: extractChatName(headerElement),
    chatType: detectChatType(messagesContainer),
    messages: parseMessages(messagesContainer),
  };
}
