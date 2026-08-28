import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatContext } from '../types';
import { buildMessages, parseSuggestions, createOpenAIProvider } from './openai';

const baseContext: ChatContext = {
  messages: [
    {
      author: 'Алиса',
      text: 'Привет! Как дела?',
      timestamp: '2025-01-15T10:00:00Z',
      isOutgoing: false,
    },
    {
      author: 'Вы',
      text: 'Всё отлично, спасибо!',
      timestamp: '2025-01-15T10:01:00Z',
      isOutgoing: true,
    },
    { author: 'Алиса', text: 'Что нового?', timestamp: '2025-01-15T10:02:00Z', isOutgoing: false },
  ],
  chatName: 'Алиса',
  chatType: 'private',
  language: 'ru',
};

describe('buildMessages', () => {
  it('prepends system prompt', () => {
    const msgs = buildMessages(baseContext, 'Custom system prompt');
    expect(msgs[0]).toEqual({ role: 'system', content: 'Custom system prompt' });
  });

  it('uses default system prompt when empty', () => {
    const msgs = buildMessages(baseContext, '');
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('Алиса');
    expect(msgs[0].content).toContain('личный чат');
  });

  it('maps outgoing messages to assistant role', () => {
    const msgs = buildMessages(baseContext, 'sys');
    const mapped = msgs.slice(1, -1);
    expect(mapped[0].role).toBe('user');
    expect(mapped[1].role).toBe('assistant');
    expect(mapped[2].role).toBe('user');
  });

  it('includes author prefix in content', () => {
    const msgs = buildMessages(baseContext, 'sys');
    expect(msgs[1].content).toContain('[Алиса]');
    expect(msgs[2].content).toContain('[Вы]');
  });

  it('appends instruction as last user message', () => {
    const msgs = buildMessages(baseContext, 'sys');
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('Предложи');
  });

  it('builds correct prompt for group chat', () => {
    const groupCtx: ChatContext = { ...baseContext, chatType: 'group', chatName: 'Рабочий чат' };
    const msgs = buildMessages(groupCtx, '');
    expect(msgs[0].content).toContain('группа');
    expect(msgs[0].content).toContain('Рабочий чат');
  });

  it('builds correct prompt for channel', () => {
    const chCtx: ChatContext = { ...baseContext, chatType: 'channel', chatName: 'Новости' };
    const msgs = buildMessages(chCtx, '');
    expect(msgs[0].content).toContain('канал');
  });

  it('handles missing language (auto)', () => {
    const ctx: ChatContext = { ...baseContext, language: undefined };
    const msgs = buildMessages(ctx, '');
    expect(msgs[0].content).toContain('auto');
  });

  it('handles empty messages array', () => {
    const ctx: ChatContext = { ...baseContext, messages: [] };
    const msgs = buildMessages(ctx, 'sys');
    expect(msgs.length).toBe(2);
  });
});

describe('parseSuggestions', () => {
  it('parses numbered list with dots', () => {
    expect(parseSuggestions('1. Привет!\n2. Как дела?\n3. Здорово!')).toEqual([
      'Привет!',
      'Как дела?',
      'Здорово!',
    ]);
  });

  it('parses numbered list with parentheses', () => {
    expect(parseSuggestions('1) Вариант А\n2) Вариант Б')).toEqual(['Вариант А', 'Вариант Б']);
  });

  it('parses dash list', () => {
    expect(parseSuggestions('- Первый\n- Второй\n- Третий')).toEqual([
      'Первый',
      'Второй',
      'Третий',
    ]);
  });

  it('parses bullet list', () => {
    expect(parseSuggestions('• Один\n• Два')).toEqual(['Один', 'Два']);
  });

  it('parses asterisk list', () => {
    expect(parseSuggestions('* Foo\n* Bar')).toEqual(['Foo', 'Bar']);
  });

  it('falls back to double-newline blocks', () => {
    expect(parseSuggestions('Первый блок\n\nВторой блок\n\nТретий')).toEqual([
      'Первый блок',
      'Второй блок',
      'Третий',
    ]);
  });

  it('returns single item for plain text', () => {
    expect(parseSuggestions('Просто один ответ')).toEqual(['Просто один ответ']);
  });

  it('trims whitespace', () => {
    expect(parseSuggestions('  1.  Пробелы  \n  2.  Везде  ')).toEqual(['Пробелы', 'Везде']);
  });

  it('handles empty string', () => {
    expect(parseSuggestions('')).toEqual(['']);
  });
});

describe('createOpenAIProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns provider with name "openai"', () => {
    const p = createOpenAIProvider({ apiKey: 'test-key', model: 'gpt-4o-mini' });
    expect(p.name).toBe('openai');
  });

  it('calls correct endpoint with auth header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '1. A\n2. B' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o-mini' });
    await p.generateReply(baseContext);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.headers.Authorization).toBe('Bearer sk-test');
  });

  it('uses custom baseUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '- A\n- B' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOpenAIProvider({
      apiKey: 'key',
      model: 'm',
      baseUrl: 'https://my-proxy.com/v1/',
    });
    await p.generateReply(baseContext);
    expect(mockFetch.mock.calls[0][0]).toBe('https://my-proxy.com/v1/chat/completions');
  });

  it('sends correct model in body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOpenAIProvider({ apiKey: 'k', model: 'gpt-4o' });
    await p.generateReply(baseContext);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o');
  });

  it('parses suggestions from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '1. Первый\n2. Второй\n3. Третий' } }],
        }),
      }),
    );
    const p = createOpenAIProvider({ apiKey: 'k', model: 'm' });
    expect(await p.generateReply(baseContext)).toEqual(['Первый', 'Второй', 'Третий']);
  });

  it('throws on API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }),
    );
    const p = createOpenAIProvider({ apiKey: 'bad', model: 'm' });
    await expect(p.generateReply(baseContext)).rejects.toThrow('OpenAI API error 401');
  });

  it('handles empty choices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }),
    );
    const p = createOpenAIProvider({ apiKey: 'k', model: 'm' });
    expect(await p.generateReply(baseContext)).toEqual(['']);
  });
});
