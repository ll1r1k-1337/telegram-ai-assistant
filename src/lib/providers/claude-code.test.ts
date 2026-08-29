import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ClaudeCodeProvider,
  checkProxyHealth,
  ClaudeCodeProviderError,
  CLAUDE_CODE_DEFAULT_PORT,
} from './claude-code';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ClaudeCodeProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should have name "claude-code"', () => {
    const provider = new ClaudeCodeProvider({});
    expect(provider.name).toBe('claude-code');
  });

  it('should use default base URL when none provided', () => {
    const provider = new ClaudeCodeProvider({});
    // We can verify by checking what URL fetch is called with
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Hello!' } }],
        }),
    });

    void provider.generateReply({
      messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
      chatName: 'Test',
      chatType: 'private',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `http://127.0.0.1:${CLAUDE_CODE_DEFAULT_PORT}/v1/chat/completions`,
      expect.any(Object),
    );
  });

  it('should use custom base URL', () => {
    const provider = new ClaudeCodeProvider({ baseUrl: 'http://localhost:9999' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Reply' } }],
        }),
    });

    void provider.generateReply({
      messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
      chatName: 'Test',
      chatType: 'private',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9999/v1/chat/completions',
      expect.any(Object),
    );
  });

  it('should strip trailing slash from base URL', () => {
    const provider = new ClaudeCodeProvider({ baseUrl: 'http://localhost:9999/' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Reply' } }],
        }),
    });

    void provider.generateReply({
      messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
      chatName: 'Test',
      chatType: 'private',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9999/v1/chat/completions',
      expect.any(Object),
    );
  });

  it('should return text from successful response', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Sure, here is a reply!' } }],
        }),
    });

    const result = await provider.generateReply({
      messages: [{ author: 'User', text: 'How are you?', timestamp: '12:00', isOutgoing: false }],
      chatName: 'Test Chat',
      chatType: 'private',
    });

    expect(result).toEqual(['Sure, here is a reply!']);
  });

  it('should send correct request body', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'ok' } }],
        }),
    });

    await provider.generateReply({
      messages: [{ author: 'User', text: 'Test', timestamp: '12:00', isOutgoing: false }],
      chatName: 'Chat',
      chatType: 'group',
    });

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);

    expect(body.model).toBe('claude-code');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(opts.headers['Content-Type']).toBe('application/json');
    // No Authorization header — claude-code doesn't need API key
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('should use enriched prompts when available', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'enriched reply' } }],
        }),
    });

    const context = {
      messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
      chatName: 'Test',
      chatType: 'private' as const,
      systemPrompt: 'Custom system prompt',
      userPrompt: 'Custom user prompt',
    };

    await provider.generateReply(context);

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);

    expect(body.messages[0].content).toBe('Custom system prompt');
    expect(body.messages[1].content).toBe('Custom user prompt');
  });

  it('should throw ClaudeCodeProviderError when proxy is down', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      provider.generateReply({
        messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
        chatName: 'Test',
        chatType: 'private',
      }),
    ).rejects.toThrow(ClaudeCodeProviderError);
  });

  it('should include proxy startup instructions in connection error', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      provider.generateReply({
        messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
        chatName: 'Test',
        chatType: 'private',
      }),
    ).rejects.toThrow(/Прокси не запущен/);
  });

  it('should throw on HTTP error from proxy', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('claude exited with code 1'),
    });

    await expect(
      provider.generateReply({
        messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
        chatName: 'Test',
        chatType: 'private',
      }),
    ).rejects.toThrow('HTTP 502');
  });

  it('should throw on empty response', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '' } }],
        }),
    });

    await expect(
      provider.generateReply({
        messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
        chatName: 'Test',
        chatType: 'private',
      }),
    ).rejects.toThrow('Empty response');
  });

  it('should throw on API-level error in response body', async () => {
    const provider = new ClaudeCodeProvider({});

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          error: { message: 'claude not authenticated' },
        }),
    });

    await expect(
      provider.generateReply({
        messages: [{ author: 'User', text: 'Hi', timestamp: '12:00', isOutgoing: false }],
        chatName: 'Test',
        chatType: 'private',
      }),
    ).rejects.toThrow('claude not authenticated');
  });
});

describe('checkProxyHealth', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return ok:true when proxy is healthy', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', claude: 'v1.2.3' }),
    });

    const result = await checkProxyHealth();
    expect(result).toEqual({ ok: true, claude: 'v1.2.3' });
  });

  it('should return ok:false when proxy reports error status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'error', claude: 'not found' }),
    });

    const result = await checkProxyHealth();
    expect(result).toEqual({ ok: false, claude: 'not found' });
  });

  it('should return ok:false when proxy is unreachable', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await checkProxyHealth();
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should use custom base URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', claude: 'v2.0' }),
    });

    await checkProxyHealth('http://localhost:9999');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:9999/health', expect.any(Object));
  });
});

describe('ClaudeCodeProviderError', () => {
  it('should have correct provider property', () => {
    const err = new ClaudeCodeProviderError('test');
    expect(err.provider).toBe('claude-code');
    expect(err.name).toBe('ClaudeCodeProviderError');
  });

  it('should prefix message with [claude-code]', () => {
    const err = new ClaudeCodeProviderError('something broke');
    expect(err.message).toBe('[claude-code] something broke');
  });
});

describe('CLAUDE_CODE_DEFAULT_PORT', () => {
  it('should be 19280', () => {
    expect(CLAUDE_CODE_DEFAULT_PORT).toBe(19280);
  });
});
