import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractMessageText,
  isOutgoingMessage,
  extractAuthor,
  extractTimestamp,
  extractReplyTo,
  parseMessageElement,
  parseMessages,
  detectChatType,
  extractChatName,
  buildChatContext,
  extractChatIdFromUrl,
  getCurrentChatIdentity,
  buildChatContextWithIdentity,
} from './parser';

/** Helper: build a Telegram-K-style message bubble */
function makeBubble(opts: {
  text?: string;
  author?: string;
  time?: string;
  isOut?: boolean;
  replyText?: string;
}): HTMLDivElement {
  const bubble = document.createElement('div');
  bubble.className = `bubble${opts.isOut ? ' is-out' : ''}`;

  // Author
  if (opts.author) {
    const name = document.createElement('span');
    name.className = 'peer-title';
    name.textContent = opts.author;
    bubble.appendChild(name);
  }

  // Text content
  if (opts.text) {
    const msgWrap = document.createElement('div');
    msgWrap.className = 'message';
    const textContent = document.createElement('span');
    textContent.className = 'text-content';
    textContent.textContent = opts.text;
    msgWrap.appendChild(textContent);
    bubble.appendChild(msgWrap);
  }

  // Timestamp
  if (opts.time) {
    const timeEl = document.createElement('time');
    timeEl.className = 'time';
    timeEl.textContent = opts.time;
    bubble.appendChild(timeEl);
  }

  // Reply
  if (opts.replyText) {
    const reply = document.createElement('div');
    reply.className = 'reply';
    reply.textContent = opts.replyText;
    bubble.appendChild(reply);
  }

  return bubble;
}

/** Helper: build a container with N bubbles */
function makeContainer(bubbles: HTMLDivElement[]): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'bubbles-inner';
  bubbles.forEach((b) => container.appendChild(b));
  return container;
}

describe('extractMessageText', () => {
  it('extracts text from .text-content', () => {
    const el = makeBubble({ text: 'Привет!' });
    expect(extractMessageText(el)).toBe('Привет!');
  });

  it('returns empty for media-only bubble', () => {
    const el = document.createElement('div');
    el.className = 'bubble';
    expect(extractMessageText(el)).toBe('');
  });

  it('trims whitespace', () => {
    const el = makeBubble({ text: '  Пробелы  ' });
    expect(extractMessageText(el)).toBe('Пробелы');
  });
});

describe('isOutgoingMessage', () => {
  it('detects .is-out class', () => {
    const el = makeBubble({ text: 'out', isOut: true });
    expect(isOutgoingMessage(el)).toBe(true);
  });

  it('returns false for incoming', () => {
    const el = makeBubble({ text: 'in', isOut: false });
    expect(isOutgoingMessage(el)).toBe(false);
  });
});

describe('extractAuthor', () => {
  it('extracts from .peer-title', () => {
    const el = makeBubble({ text: 'x', author: 'Алексей' });
    expect(extractAuthor(el)).toBe('Алексей');
  });

  it('falls back to «Вы» for outgoing', () => {
    const el = makeBubble({ text: 'x', isOut: true });
    expect(extractAuthor(el)).toBe('Вы');
  });

  it('returns Unknown when no name and incoming', () => {
    const el = makeBubble({ text: 'x' });
    expect(extractAuthor(el)).toBe('Unknown');
  });
});

describe('extractTimestamp', () => {
  it('extracts visible time text', () => {
    const el = makeBubble({ text: 'x', time: '14:32' });
    expect(extractTimestamp(el)).toBe('14:32');
  });

  it('prefers datetime attribute', () => {
    const el = document.createElement('div');
    el.className = 'bubble';
    const timeEl = document.createElement('time');
    timeEl.className = 'time';
    timeEl.setAttribute('datetime', '2025-01-15T14:32:00');
    timeEl.textContent = '14:32';
    el.appendChild(timeEl);
    expect(extractTimestamp(el)).toBe('2025-01-15T14:32:00');
  });

  it('returns empty when no time element', () => {
    const el = makeBubble({ text: 'x' });
    expect(extractTimestamp(el)).toBe('');
  });
});

describe('extractReplyTo', () => {
  it('extracts reply text', () => {
    const el = makeBubble({ text: 'x', replyText: 'Оригинал' });
    expect(extractReplyTo(el)).toBe('Оригинал');
  });

  it('returns undefined when no reply', () => {
    const el = makeBubble({ text: 'x' });
    expect(extractReplyTo(el)).toBeUndefined();
  });

  it('returns undefined for empty reply element', () => {
    const el = makeBubble({ text: 'x', replyText: '' });
    expect(extractReplyTo(el)).toBeUndefined();
  });
});

describe('parseMessageElement', () => {
  it('parses a full message', () => {
    const el = makeBubble({
      text: 'Привет!',
      author: 'Мария',
      time: '09:15',
      isOut: false,
      replyText: 'Как дела?',
    });
    const msg = parseMessageElement(el);
    expect(msg).toEqual({
      author: 'Мария',
      text: 'Привет!',
      timestamp: '09:15',
      isOutgoing: false,
      replyTo: 'Как дела?',
    });
  });

  it('returns null for text-less bubble', () => {
    const el = document.createElement('div');
    el.className = 'bubble';
    expect(parseMessageElement(el)).toBeNull();
  });
});

describe('findBubbles', () => {
  it('finds all non-service bubbles', () => {
    const container = document.createElement('div');

    const b1 = document.createElement('div');
    b1.className = 'bubble';
    const b2 = document.createElement('div');
    b2.className = 'bubble';
    const svc = document.createElement('div');
    svc.className = 'bubble service';
    const dateEl = document.createElement('div');
    dateEl.className = 'bubble is-date';

    container.append(b1, b2, svc, dateEl);

    expect(findBubbles(container)).toHaveLength(2);
  });
});

describe('getLastMessages', () => {
  it('returns last N messages in chronological order', () => {
    const bubbles = Array.from({ length: 20 }, (_, i) =>
      makeBubble({
        text: `msg-${i}`,
        author: `user-${i % 3}`,
        time: `10:${String(i).padStart(2, '0')}`,
      }),
    );
    const container = makeContainer(bubbles);

    const result = getLastMessages(5, container);
    expect(result).toHaveLength(5);
    expect(result[0].text).toBe('msg-15');
    expect(result[4].text).toBe('msg-19');
  });

  it('returns all when fewer than N messages exist', () => {
    const bubbles = [
      makeBubble({ text: 'one', author: 'A', time: '10:00' }),
      makeBubble({ text: 'two', author: 'B', time: '10:01' }),
    ];
    const container = makeContainer(bubbles);

    const result = getLastMessages(10, container);
    expect(result).toHaveLength(2);
  });

  it('skips text-less bubbles', () => {
    const container = document.createElement('div');
    container.className = 'bubbles-inner';

    // Text bubble
    container.appendChild(makeBubble({ text: 'hello', author: 'X' }));
    // Media-only bubble (no text)
    const mediaBubble = document.createElement('div');
    mediaBubble.className = 'bubble';
    container.appendChild(mediaBubble);
    // Another text bubble
    container.appendChild(makeBubble({ text: 'world', author: 'Y' }));

    const result = getLastMessages(10, container);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('hello');
    expect(result[1].text).toBe('world');
  });

  it('clamps N to [1, 50]', () => {
    const bubbles = Array.from({ length: 3 }, (_, i) =>
      makeBubble({ text: `m${i}` }),
    );
    const container = makeContainer(bubbles);

    expect(getLastMessages(0, container)).toHaveLength(1);
    expect(getLastMessages(-5, container)).toHaveLength(1);
    expect(getLastMessages(100, container)).toHaveLength(3);
  });

  it('returns empty when container is null', () => {
    expect(getLastMessages(10, null)).toEqual([]);
  });

  it('defaults to 15 messages', () => {
    const bubbles = Array.from({ length: 25 }, (_, i) =>
      makeBubble({ text: `m${i}`, author: 'A' }),
    );
    const container = makeContainer(bubbles);

    const result = getLastMessages(undefined, container);
    expect(result).toHaveLength(15);
    expect(result[0].text).toBe('m10');
  });
});

/* ─── extractChatIdFromUrl ─────────────────────────────── */

describe('extractChatIdFromUrl', () => {
  it('extracts negative numeric id from /k/ URL', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/k/#-1001234567890')).toBe(
      '-1001234567890',
    );
  });

  it('extracts positive numeric id', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/k/#777000')).toBe('777000');
  });

  it('extracts @username', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/k/#@durov')).toBe('@durov');
  });

  it('extracts id from /a/ URL', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/a/#-1001234567890')).toBe(
      '-1001234567890',
    );
  });

  it('extracts id from /z/ URL', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/z/#-4567890')).toBe('-4567890');
  });

  it('returns null for empty hash', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/k/')).toBeNull();
  });

  it('returns null for hash with no id', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/k/#')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(extractChatIdFromUrl('not a url')).toBeNull();
  });

  it('handles hash with extra path segments', () => {
    expect(extractChatIdFromUrl('https://web.telegram.org/k/#-1001234567890/42')).toBe(
      '-1001234567890',
    );
  });
});

/* ─── getCurrentChatIdentity ───────────────────────────── */

describe('getCurrentChatIdentity', () => {
  it('returns id from URL and name from header', () => {
    const header = el('<div><span class="peer-title">Рабочий чат</span></div>');
    const identity = getCurrentChatIdentity('https://web.telegram.org/k/#-1001234567890', header);
    expect(identity.id).toBe('-1001234567890');
    expect(identity.name).toBe('Рабочий чат');
  });

  it('returns null id when no hash', () => {
    const header = el('<div><span class="peer-title">Чат</span></div>');
    const identity = getCurrentChatIdentity('https://web.telegram.org/k/', header);
    expect(identity.id).toBeNull();
    expect(identity.name).toBe('Чат');
  });

  it('returns "Unknown Chat" when header is null', () => {
    const identity = getCurrentChatIdentity('https://web.telegram.org/k/#123456', null);
    expect(identity.id).toBe('123456');
    expect(identity.name).toBe('Unknown Chat');
  });
});

/* ─── buildChatContextWithIdentity ─────────────────────── */

describe('buildChatContextWithIdentity', () => {
  it('includes chatIdentity in context', () => {
    const msgs = el(`<div>
      <div class="bubble"><span class="peer-title">Алиса</span><span class="message">Привет!</span></div>
    </div>`);
    const header = el('<div><span class="peer-title">Алиса</span></div>');
    const ctx = buildChatContextWithIdentity(
      msgs,
      header,
      'https://web.telegram.org/k/#-1009876543',
    );
    expect(ctx.chatName).toBe('Алиса');
    expect(ctx.chatIdentity).toBeDefined();
    expect(ctx.chatIdentity!.id).toBe('-1009876543');
    expect(ctx.chatIdentity!.name).toBe('Алиса');
  });

  it('still parses messages correctly', () => {
    const msgs = el(`<div>
      <div class="bubble is-out"><span class="message">Тест</span></div>
    </div>`);
    const header = el('<div><h3>Канал</h3></div>');
    const ctx = buildChatContextWithIdentity(msgs, header, 'https://web.telegram.org/k/#-100111');
    expect(ctx.messages.length).toBe(1);
    expect(ctx.messages[0].text).toBe('Тест');
    expect(ctx.chatIdentity!.id).toBe('-100111');
  });
});
