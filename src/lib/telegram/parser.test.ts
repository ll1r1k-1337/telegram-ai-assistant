/**
 * E9-001: Unit-тесты парсинга DOM (vitest + jsdom environment)
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  extractMessageText,
  isOutgoingMessage,
  extractAuthor,
  extractTimestamp,
  extractReplyTo,
  extractForwardInfo,
  isEditedMessage,
  detectMediaType,
  parseMessageElement,
  parseMessages,
  detectChatType,
  extractChatName,
  buildChatContext,
} from './parser';

function el(html: string): Element {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild!;
}

/* ─── extractMessageText ────────────────────────────────── */

describe('extractMessageText', () => {
  it('extracts from .message child', () => {
    expect(
      extractMessageText(el('<div class="bubble"><span class="message">Привет!</span></div>')),
    ).toBe('Привет!');
  });

  it('extracts from .text-content', () => {
    expect(
      extractMessageText(el('<div class="bubble"><span class="text-content">Hello</span></div>')),
    ).toBe('Hello');
  });

  it('extracts from .caption', () => {
    expect(
      extractMessageText(el('<div class="bubble"><span class="caption">Подпись</span></div>')),
    ).toBe('Подпись');
  });

  it('returns empty when no text element found', () => {
    expect(extractMessageText(el('<div class="empty"></div>'))).toBe('');
  });

  it('trims whitespace', () => {
    expect(extractMessageText(el('<div><span class="text-content">  spaces  </span></div>'))).toBe(
      'spaces',
    );
  });
});

/* ─── isOutgoingMessage ─────────────────────────────────── */

describe('isOutgoingMessage', () => {
  it('detects .is-out on element', () => {
    expect(isOutgoingMessage(el('<div class="bubble is-out"></div>'))).toBe(true);
  });

  it('detects .is-out on parent .bubble via closest', () => {
    const container = el('<div class="bubble is-out"><div class="inner"></div></div>');
    const inner = container.querySelector('.inner')!;
    expect(isOutgoingMessage(inner)).toBe(true);
  });

  it('returns false for incoming message', () => {
    expect(isOutgoingMessage(el('<div class="bubble"></div>'))).toBe(false);
  });
});

/* ─── extractAuthor ─────────────────────────────────────── */

describe('extractAuthor', () => {
  it('extracts from .peer-title', () => {
    expect(extractAuthor(el('<div><span class="peer-title">Алиса</span></div>'))).toBe('Алиса');
  });

  it('extracts from .name', () => {
    expect(extractAuthor(el('<div><span class="name">Боб</span></div>'))).toBe('Боб');
  });

  it('returns "Вы" for outgoing without author element', () => {
    expect(
      extractAuthor(el('<div class="bubble is-out"><span class="text-content">hi</span></div>')),
    ).toBe('Вы');
  });

  it('returns "Unknown" when nothing found', () => {
    expect(extractAuthor(el('<div class="bubble"><span class="text-content">t</span></div>'))).toBe(
      'Unknown',
    );
  });
});

/* ─── extractTimestamp ──────────────────────────────────── */

describe('extractTimestamp', () => {
  it('extracts from .time element text', () => {
    expect(extractTimestamp(el('<div><span class="time">14:30</span></div>'))).toBe('14:30');
  });

  it('prefers datetime attribute on <time> element', () => {
    expect(
      extractTimestamp(el('<div><time datetime="2025-01-15T14:30:00Z">14:30</time></div>')),
    ).toBe('2025-01-15T14:30:00Z');
  });

  it('extracts from .time-inner', () => {
    expect(extractTimestamp(el('<div><span class="time-inner">15:00</span></div>'))).toBe('15:00');
  });

  it('returns empty when no time element', () => {
    expect(extractTimestamp(el('<div class="bubble"></div>'))).toBe('');
  });
});

/* ─── extractReplyTo ────────────────────────────────────── */

describe('extractReplyTo', () => {
  it('extracts reply text from .reply', () => {
    expect(extractReplyTo(el('<div><div class="reply">Цитата</div></div>'))).toBe('Цитата');
  });

  it('extracts from .reply-subtitle inside .reply', () => {
    expect(
      extractReplyTo(
        el('<div><div class="reply"><span class="reply-subtitle">Подтекст</span></div></div>'),
      ),
    ).toBe('Подтекст');
  });

  it('returns undefined when no reply', () => {
    expect(extractReplyTo(el('<div class="bubble"></div>'))).toBeUndefined();
  });

  it('returns undefined for empty reply', () => {
    expect(extractReplyTo(el('<div><div class="reply">  </div></div>'))).toBeUndefined();
  });
});

/* ─── extractForwardInfo ────────────────────────────────── */

describe('extractForwardInfo', () => {
  it('extracts from .forward block', () => {
    const info = extractForwardInfo(
      el('<div><div class="forward">Forwarded from Channel</div></div>'),
    );
    expect(info).toBeDefined();
    expect(info!.from).toBe('Channel');
  });

  it('extracts from .forwarded-header', () => {
    const info = extractForwardInfo(
      el('<div><div class="forwarded-header">Переслано от Иван</div></div>'),
    );
    expect(info).toBeDefined();
    expect(info!.from).toBe('Иван');
  });

  it('extracts from .peer-title inside .forward', () => {
    const info = extractForwardInfo(
      el('<div><div class="forward"><span class="peer-title">Source</span></div></div>'),
    );
    expect(info).toBeDefined();
    expect(info!.from).toBe('Source');
  });

  it('returns undefined when no forward', () => {
    expect(extractForwardInfo(el('<div class="bubble"></div>'))).toBeUndefined();
  });
});

/* ─── isEditedMessage ───────────────────────────────────── */

describe('isEditedMessage', () => {
  it('detects .edited class', () => {
    expect(isEditedMessage(el('<div><span class="edited"></span></div>'))).toBe(true);
  });

  it('detects "edited" text in .time', () => {
    expect(isEditedMessage(el('<div><span class="time">edited 14:30</span></div>'))).toBe(true);
  });

  it('detects "ред." text in .time', () => {
    expect(isEditedMessage(el('<div><span class="time">ред. 14:30</span></div>'))).toBe(true);
  });

  it('returns false for non-edited', () => {
    expect(isEditedMessage(el('<div><span class="time">14:30</span></div>'))).toBe(false);
  });
});

/* ─── detectMediaType ───────────────────────────────────── */

describe('detectMediaType', () => {
  it('detects photo', () => {
    expect(detectMediaType(el('<div><div class="media-photo"></div></div>'))).toBe('photo');
  });

  it('detects video', () => {
    expect(detectMediaType(el('<div><div class="media-video"></div></div>'))).toBe('video');
  });

  it('detects sticker', () => {
    expect(detectMediaType(el('<div><div class="media-sticker"></div></div>'))).toBe('sticker');
  });

  it('detects voice', () => {
    expect(detectMediaType(el('<div><div class="media-voice"></div></div>'))).toBe('voice');
  });

  it('detects document', () => {
    expect(detectMediaType(el('<div><div class="document"></div></div>'))).toBe('document');
  });

  it('detects gif', () => {
    expect(detectMediaType(el('<div><div class="gif"></div></div>'))).toBe('gif');
  });

  it('returns undefined for text-only', () => {
    expect(
      detectMediaType(el('<div><span class="text-content">text</span></div>')),
    ).toBeUndefined();
  });
});

/* ─── parseMessageElement ───────────────────────────────── */

describe('parseMessageElement', () => {
  it('parses complete text message', () => {
    const msg = parseMessageElement(
      el(`
      <div class="bubble">
        <span class="peer-title">Иван</span>
        <span class="message">Привет!</span>
        <span class="time">10:00</span>
      </div>`),
    );
    expect(msg).not.toBeNull();
    expect(msg!.author).toBe('Иван');
    expect(msg!.text).toBe('Привет!');
    expect(msg!.timestamp).toBe('10:00');
    expect(msg!.isOutgoing).toBe(false);
  });

  it('returns null for empty service message', () => {
    expect(parseMessageElement(el('<div class="bubble"></div>'))).toBeNull();
  });

  it('parses outgoing message with reply', () => {
    const msg = parseMessageElement(
      el(`
      <div class="bubble is-out">
        <div class="reply">Оригинал</div>
        <span class="text-content">Мой ответ</span>
        <span class="time">10:05</span>
      </div>`),
    );
    expect(msg!.isOutgoing).toBe(true);
    expect(msg!.author).toBe('Вы');
    expect(msg!.replyTo).toBe('Оригинал');
  });

  it('parses media-only message with placeholder text', () => {
    const msg = parseMessageElement(
      el(`
      <div class="bubble">
        <span class="peer-title">User</span>
        <div class="media-photo"></div>
      </div>`),
    );
    expect(msg).not.toBeNull();
    expect(msg!.text).toBe('[photo]');
    expect(msg!.mediaType).toBe('photo');
  });

  it('parses media message with caption', () => {
    const msg = parseMessageElement(
      el(`
      <div class="bubble">
        <span class="peer-title">User</span>
        <div class="media-video"></div>
        <span class="caption">Подпись к видео</span>
      </div>`),
    );
    expect(msg).not.toBeNull();
    expect(msg!.text).toBe('Подпись к видео');
    expect(msg!.mediaType).toBe('video');
  });
});

/* ─── parseMessages ─────────────────────────────────────── */

describe('parseMessages', () => {
  it('parses multiple bubbles', () => {
    const msgs = parseMessages(
      el(`<div>
      <div class="bubble"><span class="peer-title">А</span><span class="message">Один</span></div>
      <div class="bubble is-out"><span class="message">Два</span></div>
      <div class="bubble"><span class="peer-title">А</span><span class="message">Три</span></div>
    </div>`),
    );
    expect(msgs.length).toBe(3);
    expect(msgs[1].isOutgoing).toBe(true);
  });

  it('skips empty bubbles', () => {
    const msgs = parseMessages(
      el(`<div>
      <div class="bubble"></div>
      <div class="bubble"><span class="message">Есть</span></div>
    </div>`),
    );
    expect(msgs.length).toBe(1);
  });

  it('returns empty array for empty container', () => {
    expect(parseMessages(el('<div></div>'))).toEqual([]);
  });
});

/* ─── detectChatType ────────────────────────────────────── */

describe('detectChatType', () => {
  it('detects channel by .is-channel', () => {
    expect(detectChatType(el('<div><span class="is-channel"></span></div>'))).toBe('channel');
  });

  it('detects group by multiple distinct authors', () => {
    expect(
      detectChatType(
        el(`<div>
      <div class="bubble"><span class="peer-title">А</span></div>
      <div class="bubble"><span class="peer-title">Б</span></div>
    </div>`),
      ),
    ).toBe('group');
  });

  it('detects private (single author)', () => {
    expect(
      detectChatType(
        el(`<div>
      <div class="bubble"><span class="peer-title">А</span></div>
      <div class="bubble is-out"></div>
    </div>`),
      ),
    ).toBe('private');
  });

  it('private for empty container', () => {
    expect(detectChatType(el('<div></div>'))).toBe('private');
  });
});

/* ─── extractChatName ───────────────────────────────────── */

describe('extractChatName', () => {
  it('extracts from .peer-title', () => {
    expect(extractChatName(el('<div><span class="peer-title">Рабочий чат</span></div>'))).toBe(
      'Рабочий чат',
    );
  });

  it('extracts from h3', () => {
    expect(extractChatName(el('<div><h3>Канал</h3></div>'))).toBe('Канал');
  });

  it('returns "Unknown Chat" when nothing found', () => {
    expect(extractChatName(el('<div></div>'))).toBe('Unknown Chat');
  });
});

/* ─── buildChatContext ──────────────────────────────────── */

describe('buildChatContext', () => {
  it('builds complete context from DOM', () => {
    const msgs = el(`<div>
      <div class="bubble"><span class="peer-title">Алиса</span><span class="message">Привет!</span><span class="time">10:00</span></div>
      <div class="bubble is-out"><span class="message">Привет!</span><span class="time">10:01</span></div>
    </div>`);
    const header = el('<div><span class="peer-title">Алиса</span></div>');
    const ctx = buildChatContext(msgs, header);
    expect(ctx.chatName).toBe('Алиса');
    expect(ctx.chatType).toBe('private');
    expect(ctx.messages.length).toBe(2);
    expect(ctx.messages[0].author).toBe('Алиса');
    expect(ctx.messages[1].isOutgoing).toBe(true);
  });
});
