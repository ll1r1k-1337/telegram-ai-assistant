import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatContext } from '../types';
import { parseSuggestions, ClaudeCodeProvider, ClaudeCodeProviderError } from './claude-code';

/* ---- parseSuggestions ---- */

describe('parseSuggestions', () => {
  it('parses numbered list with dots', () => {
    expect(parseSuggestions('1. Привет\n2. Здравствуй\n3. Хай')).toEqual([
      'Привет',
      'Здравствуй',
      'Хай',
    ]);
  });

  it('parses numbered list with parentheses', () => {
    expect(parseSuggestions('1) Hello\n2) World')).toEqual(['Hello', 'World']);
  });

  it('skips blank lines', () => {
    expect(parseSuggestions('1. A\n\n2. B\n\n3. C')).toEqual(['A', 'B', 'C']);
  });

  it('falls back to full text when no numbered items found', () => {
    expect(parseSuggestions('Just a plain reply')).toEqual(['Just a plain reply']);
  });

  it('trims whitespace', () => {
    expect(parseSuggestions('  1.  padded  \n  2.  also padded  ')).toEqual([
      'padded',
      'also padded',
    ]);
  });

  it('handles mixed numbered and non-numbered lines', () => {
    const text = 'Here are options:\n1. First\n2. Second\nExtra text';
    expect(parseSuggestions(text)).toEqual(['First', 'Second']);
  });

  it('returns empty-string fallback for whitespace-only input', () => {
    expect(parseSuggestions('   ')).toEqual(['']);
  });
});

/* ---- ClaudeCodeProviderError ---- */

describe('ClaudeCodeProviderError', () => {
  it('has correct name and provider', () => {
    const err = new ClaudeCodeProviderError('test');
    expect(err.name).toBe('ClaudeCodeProviderError');
    expect(err.provider).toBe('claude-code');
    expect(err.message).toContain('[claude-code]');
  });

  it('is an instance of Error', () => {
    expect(new ClaudeCodeProviderError('x')).toBeInstanceOf(Error);
  });
});

/* ---- ClaudeCodeProvider ---- */

const baseContext: ChatContext = {
  messages: [
    { author: 'Алиса', text: 'Как дела?', timestamp: '2025-01-15T10:00:00Z', isOutgoing: false },
    { author: 'Вы', text: 'Нормально!', timestamp: '2025-01-15T10:01:00Z', isOutgoing: true },
  ],
  chatName: 'Алиса',
  chatType: 'private',
};

describe('ClaudeCodeProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock chrome.runtime.sendNativeMessage for tests
    const chromeStub = {
      runtime: {
        sendNativeMessage: vi.fn(),
        lastError: null as chrome.runtime.LastError | null,
      },
    };
    vi.stubGlobal('chrome', chromeStub);
  });

  it('has name "claude-code"', () => {
    const p = new ClaudeCodeProvider();
    expect(p.name).toBe('claude-code');
  });

  it('calls sendNativeMessage with correct host name and GENERATE type', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      (cb as (r: unknown) => void)({ type: 'RESULT', text: '1. Ответ' });
    });

    const p = new ClaudeCodeProvider();
    await p.generateReply(baseContext);

    expect(sendNative).toHaveBeenCalledOnce();
    const [hostName, msg] = sendNative.mock.calls[0];
    expect(hostName).toBe('com.telegram_ai_assistant.claude_bridge');
    expect(msg).toHaveProperty('type', 'GENERATE');
    expect(msg).toHaveProperty('prompt');
  });

  it('passes model when configured', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      (cb as (r: unknown) => void)({ type: 'RESULT', text: '1. X' });
    });

    const p = new ClaudeCodeProvider({ model: 'claude-sonnet-4-20250514' });
    await p.generateReply(baseContext);

    const msg = sendNative.mock.calls[0][1] as { model?: string };
    expect(msg.model).toBe('claude-sonnet-4-20250514');
  });

  it('parses numbered suggestions from result', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      (cb as (r: unknown) => void)({
        type: 'RESULT',
        text: '1. Привет!\n2. Здравствуй!\n3. Хай!',
      });
    });

    const p = new ClaudeCodeProvider();
    const result = await p.generateReply(baseContext);
    expect(result).toEqual(['Привет!', 'Здравствуй!', 'Хай!']);
  });

  it('throws on ERROR response from native host', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      (cb as (r: unknown) => void)({ type: 'ERROR', error: 'CLI not found' });
    });

    const p = new ClaudeCodeProvider();
    await expect(p.generateReply(baseContext)).rejects.toThrow('CLI not found');
  });

  it('throws on empty response text', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      (cb as (r: unknown) => void)({ type: 'RESULT', text: '' });
    });

    const p = new ClaudeCodeProvider();
    await expect(p.generateReply(baseContext)).rejects.toThrow('Empty response');
  });

  it('throws on chrome.runtime.lastError', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      // Simulate Chrome API error
      Object.defineProperty(chrome.runtime, 'lastError', {
        value: { message: 'Native host has exited' },
        configurable: true,
      });
      (cb as (r: unknown) => void)(undefined);
    });

    const p = new ClaudeCodeProvider();
    await expect(p.generateReply(baseContext)).rejects.toThrow('Native host has exited');
  });

  it('ping returns true on PONG', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, _msg, cb) => {
      (cb as (r: unknown) => void)({ type: 'PONG', version: '1.0.0' });
    });

    const p = new ClaudeCodeProvider();
    expect(await p.ping()).toBe(true);
  });

  it('ping returns false on error', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation(() => {
      throw new Error('Not available');
    });

    const p = new ClaudeCodeProvider();
    expect(await p.ping()).toBe(false);
  });

  it('includes chat context in prompt', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, msg, cb) => {
      const prompt = (msg as { prompt: string }).prompt;
      // Verify prompt includes chat context
      expect(prompt).toContain('Алиса');
      expect(prompt).toContain('Как дела?');
      expect(prompt).toContain('личный чат');
      (cb as (r: unknown) => void)({ type: 'RESULT', text: '1. OK' });
    });

    const p = new ClaudeCodeProvider();
    await p.generateReply(baseContext);
  });

  it('uses enriched userPrompt when available', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, msg, cb) => {
      const prompt = (msg as { prompt: string }).prompt;
      expect(prompt).toBe('Custom prompt from reply-generator');
      (cb as (r: unknown) => void)({ type: 'RESULT', text: '1. Reply' });
    });

    const p = new ClaudeCodeProvider();
    const enriched = {
      ...baseContext,
      userPrompt: 'Custom prompt from reply-generator',
    } as ChatContext & { userPrompt: string };
    await p.generateReply(enriched);
  });

  it('handles group chat type in prompt', async () => {
    const sendNative = vi.mocked(chrome.runtime.sendNativeMessage);
    sendNative.mockImplementation((_host, msg, cb) => {
      const prompt = (msg as { prompt: string }).prompt;
      expect(prompt).toContain('групповой чат');
      (cb as (r: unknown) => void)({ type: 'RESULT', text: '1. Hi' });
    });

    const p = new ClaudeCodeProvider();
    await p.generateReply({ ...baseContext, chatType: 'group' });
  });
});
