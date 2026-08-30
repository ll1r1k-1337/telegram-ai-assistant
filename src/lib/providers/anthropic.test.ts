import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatContext } from '../types';
import { buildAnthropicBody, createAnthropicProvider } from './anthropic';

const baseContext: ChatContext = {
  messages: [
    { author: 'Боб', text: 'Привет!', timestamp: '2025-01-15T10:00:00Z', isOutgoing: false },
    { author: 'Вы', text: 'Здравствуй!', timestamp: '2025-01-15T10:01:00Z', isOutgoing: true },
  ],
  chatName: 'Боб',
  chatType: 'private',
};

describe('buildAnthropicBody', () => {
  it('includes system prompt', () => {
    const body = buildAnthropicBody(baseContext, 'claude-3-haiku', 'custom sys');
    expect(body.system).toBe('custom sys');
  });

  it('generates default system prompt with chat name', () => {
    const body = buildAnthropicBody(baseContext, 'claude-3-haiku');
    expect(body.system).toContain('Боб');
  });

  it('sets model correctly', () => {
    expect(buildAnthropicBody(baseContext, 'claude-3-5-sonnet').model).toBe('claude-3-5-sonnet');
  });

  it('sets max_tokens', () => {
    expect(buildAnthropicBody(baseContext, 'm').max_tokens).toBe(1024);
  });

  it('alternates user/assistant roles', () => {
    const body = buildAnthropicBody(baseContext, 'm');
    const roles = body.messages.map((m: { role: string; content: string }) => m.role);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1]);
    }
  });

  it('ensures first message is user role', () => {
    expect(buildAnthropicBody(baseContext, 'm').messages[0].role).toBe('user');
  });

  it('collapses consecutive same-role messages', () => {
    const ctx: ChatContext = {
      messages: [
        { author: 'A', text: 'msg1', timestamp: '', isOutgoing: false },
        { author: 'B', text: 'msg2', timestamp: '', isOutgoing: false },
        { author: 'Вы', text: 'reply', timestamp: '', isOutgoing: true },
      ],
      chatName: 'Group',
      chatType: 'group',
    };
    const body = buildAnthropicBody(ctx, 'm');
    const firstUser = body.messages.find((m: { role: string; content: string }) => m.role === 'user')!;
    expect(firstUser.content).toContain('msg1');
    expect(firstUser.content).toContain('msg2');
  });

  it('handles empty messages', () => {
    const ctx: ChatContext = { messages: [], chatName: 'Test', chatType: 'private' };
    const body = buildAnthropicBody(ctx, 'm');
    expect(body.messages.length).toBeGreaterThanOrEqual(1);
    expect(body.messages[0].role).toBe('user');
  });
});

describe('createAnthropicProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns provider with name "anthropic"', () => {
    expect(createAnthropicProvider({ apiKey: 'k', model: 'm' }).name).toBe('anthropic');
  });

  it('calls correct endpoint with headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '1. A\n2. B' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const p = createAnthropicProvider({ apiKey: 'sk-ant-test', model: 'claude-3-haiku' });
    await p.generateReply(baseContext);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('sk-ant-test');
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('parses text blocks from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '1. А\n2. Б\n3. В' }] }),
      }),
    );
    const p = createAnthropicProvider({ apiKey: 'k', model: 'm' });
    expect(await p.generateReply(baseContext)).toEqual(['А', 'Б', 'В']);
  });

  it('concatenates multiple text blocks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: '- One' },
            { type: 'thinking', text: 'ignore me' },
            { type: 'text', text: '- Two' },
          ],
        }),
      }),
    );
    const p = createAnthropicProvider({ apiKey: 'k', model: 'm' });
    expect(await p.generateReply(baseContext)).toEqual(['One', 'Two']);
  });

  it('throws on API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' }),
    );
    const p = createAnthropicProvider({ apiKey: 'bad', model: 'm' });
    await expect(p.generateReply(baseContext)).rejects.toThrow('Anthropic API error 403');
  });
});
