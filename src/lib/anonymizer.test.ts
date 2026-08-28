import { describe, it, expect } from 'vitest';
import type { ChatContext, ChatMessage } from './types';
import {
  buildNameMap,
  anonymizeContext,
  deanonymizeText,
} from './anonymizer';

// ── helpers ──────────────────────────────────────────────────────────

function msg(overrides: Partial<ChatMessage> & { author: string; text: string }): ChatMessage {
  return {
    timestamp: '14:00',
    isOutgoing: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    chatName: 'Рабочий чат',
    chatType: 'group',
    messages: [],
    ...overrides,
  };
}

// ── buildNameMap ─────────────────────────────────────────────────────

describe('buildNameMap', () => {
  it('maps distinct authors to sequential pseudonyms', () => {
    const c = ctx({
      messages: [
        msg({ author: 'Алексей', text: 'Привет' }),
        msg({ author: 'Мария', text: 'Привет!' }),
      ],
    });
    const map = buildNameMap(c);

    expect(map.forward.get('Алексей')).toBe('Собеседник A');
    expect(map.forward.get('Мария')).toBe('Собеседник B');
    expect(map.reverse.get('Собеседник A')).toBe('Алексей');
    expect(map.reverse.get('Собеседник B')).toBe('Мария');
  });

  it('skips "Вы" (self)', () => {
    const c = ctx({
      messages: [
        msg({ author: 'Вы', text: 'Мой текст', isOutgoing: true }),
        msg({ author: 'Олег', text: 'Ответ' }),
      ],
    });
    const map = buildNameMap(c);

    expect(map.forward.has('Вы')).toBe(false);
    expect(map.forward.get('Олег')).toBe('Собеседник A');
  });

  it('skips "Unknown"', () => {
    const c = ctx({
      messages: [msg({ author: 'Unknown', text: 'Анонимка' })],
    });
    const map = buildNameMap(c);
    expect(map.forward.size).toBe(1); // only chatName
  });

  it('includes forwarded-from names', () => {
    const c = ctx({
      messages: [
        msg({
          author: 'Иван',
          text: 'Переслал новость',
          forward: { from: 'Канал Новости' },
        }),
      ],
    });
    const map = buildNameMap(c);
    expect(map.forward.has('Канал Новости')).toBe(true);
  });

  it('includes chatName when not already an author', () => {
    const c = ctx({
      chatName: 'Девелоперы',
      messages: [msg({ author: 'Алексей', text: 'Привет' })],
    });
    const map = buildNameMap(c);
    expect(map.forward.has('Девелоперы')).toBe(true);
    expect(map.forward.has('Алексей')).toBe(true);
  });

  it('does not duplicate chatName when it matches an author', () => {
    const c = ctx({
      chatName: 'Алексей',
      chatType: 'private',
      messages: [msg({ author: 'Алексей', text: 'Привет' })],
    });
    const map = buildNameMap(c);
    expect(map.forward.size).toBe(1);
    expect(map.forward.get('Алексей')).toBe('Собеседник A');
  });

  it('handles empty messages', () => {
    const c = ctx({ messages: [] });
    const map = buildNameMap(c);
    // chatName still mapped
    expect(map.forward.size).toBe(1);
  });
});

// ── anonymizeContext ─────────────────────────────────────────────────

describe('anonymizeContext', () => {
  it('replaces author names in messages', () => {
    const c = ctx({
      messages: [
        msg({ author: 'Алексей', text: 'Привет' }),
        msg({ author: 'Мария', text: 'Привет!' }),
      ],
    });
    const map = buildNameMap(c);
    const anon = anonymizeContext(c, map);

    expect(anon.messages[0].author).toBe('Собеседник A');
    expect(anon.messages[1].author).toBe('Собеседник B');
  });

  it('replaces chatName', () => {
    const c = ctx({ chatName: 'Девелоперы', messages: [] });
    const map = buildNameMap(c);
    const anon = anonymizeContext(c, map);

    expect(anon.chatName).toBe('Собеседник A');
  });

  it('preserves "Вы" as is', () => {
    const c = ctx({
      messages: [msg({ author: 'Вы', text: 'Мой текст', isOutgoing: true })],
    });
    const map = buildNameMap(c);
    const anon = anonymizeContext(c, map);

    expect(anon.messages[0].author).toBe('Вы');
  });

  it('anonymizes forward.from', () => {
    const c = ctx({
      messages: [
        msg({
          author: 'Иван',
          text: 'Переслал',
          forward: { from: 'Канал Новости' },
        }),
      ],
    });
    const map = buildNameMap(c);
    const anon = anonymizeContext(c, map);

    expect(anon.messages[0].forward?.from).toBe(
      map.forward.get('Канал Новости'),
    );
  });

  it('does not mutate the original context', () => {
    const c = ctx({
      messages: [msg({ author: 'Алексей', text: 'Привет' })],
    });
    const map = buildNameMap(c);
    anonymizeContext(c, map);

    expect(c.messages[0].author).toBe('Алексей');
    expect(c.chatName).toBe('Рабочий чат');
  });

  it('preserves non-name fields', () => {
    const c = ctx({
      chatType: 'group',
      language: 'ru',
      messages: [
        msg({
          author: 'Алексей',
          text: 'Привет',
          timestamp: '14:30',
          isOutgoing: false,
          replyTo: 'Как дела?',
        }),
      ],
    });
    const map = buildNameMap(c);
    const anon = anonymizeContext(c, map);

    expect(anon.chatType).toBe('group');
    expect(anon.language).toBe('ru');
    expect(anon.messages[0].text).toBe('Привет');
    expect(anon.messages[0].timestamp).toBe('14:30');
    expect(anon.messages[0].replyTo).toBe('Как дела?');
  });
});

// ── deanonymizeText ──────────────────────────────────────────────────

describe('deanonymizeText', () => {
  it('replaces pseudonyms back to real names', () => {
    const c = ctx({
      messages: [
        msg({ author: 'Алексей', text: 'Привет' }),
        msg({ author: 'Мария', text: 'Привет!' }),
      ],
    });
    const map = buildNameMap(c);

    const input = 'Собеседник A: привет! Собеседник B тоже здесь.';
    const result = deanonymizeText(input, map);
    expect(result).toBe('Алексей: привет! Мария тоже здесь.');
  });

  it('handles text with no pseudonyms', () => {
    const c = ctx({ messages: [msg({ author: 'Олег', text: 'Тест' })] });
    const map = buildNameMap(c);

    expect(deanonymizeText('Просто текст', map)).toBe('Просто текст');
  });

  it('handles multiple occurrences', () => {
    const c = ctx({ messages: [msg({ author: 'Катя', text: 'Да' })] });
    const map = buildNameMap(c);

    const input = 'Собеседник A сказал, потом Собеседник A добавил';
    const result = deanonymizeText(input, map);
    expect(result).toBe('Катя сказал, потом Катя добавил');
  });

  it('returns empty string for empty input', () => {
    const c = ctx({ messages: [] });
    const map = buildNameMap(c);
    expect(deanonymizeText('', map)).toBe('');
  });
});
