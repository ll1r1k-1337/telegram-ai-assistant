import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatContext } from '../types';
import { createOllamaProvider } from './ollama';

const baseContext: ChatContext = {
  messages: [
    { author: 'Карл', text: 'Привет', timestamp: '2025-01-15T10:00:00Z', isOutgoing: false },
  ],
  chatName: 'Карл',
  chatType: 'private',
};

describe('createOllamaProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns provider with name "ollama"', () => {
    expect(createOllamaProvider({ model: 'llama3' }).name).toBe('ollama');
  });

  it('calls default localhost endpoint', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: '1. Раз\n2. Два' }) });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOllamaProvider({ model: 'llama3' });
    await p.generateReply(baseContext);
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:11434/api/generate');
  });

  it('uses custom baseUrl', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: 'ok' }) });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOllamaProvider({ model: 'llama3', baseUrl: 'http://remote:11434/' });
    await p.generateReply(baseContext);
    expect(mockFetch.mock.calls[0][0]).toBe('http://remote:11434/api/generate');
  });

  it('sends model and stream=false in body', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: 'test' }) });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOllamaProvider({ model: 'mistral' });
    await p.generateReply(baseContext);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('mistral');
    expect(body.stream).toBe(false);
  });

  it('includes chat messages in prompt', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: 'test' }) });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOllamaProvider({ model: 'm' });
    await p.generateReply(baseContext);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toContain('[Карл]: Привет');
  });

  it('uses custom system prompt', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: 'ok' }) });
    vi.stubGlobal('fetch', mockFetch);
    const p = createOllamaProvider({ model: 'm', systemPrompt: 'Custom Ollama sys' });
    await p.generateReply(baseContext);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).system).toBe('Custom Ollama sys');
  });

  it('parses suggestions from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: '1. Здравствуйте!\n2. Привет!\n3. Хай!' }),
      }),
    );
    const p = createOllamaProvider({ model: 'm' });
    expect(await p.generateReply(baseContext)).toEqual(['Здравствуйте!', 'Привет!', 'Хай!']);
  });

  it('throws on API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, text: async () => 'Internal Server Error' }),
    );
    const p = createOllamaProvider({ model: 'm' });
    await expect(p.generateReply(baseContext)).rejects.toThrow('Ollama API error 500');
  });
});
