// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import {
  STREAM_PORT_NAME,
  streamOverPort,
  type StreamCallback,
} from '../lib/streaming';
import type { ChatContext, StreamRequest } from '../lib/types';


console.log('[TG-AI] Background service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[TG-AI] Extension installed — launching onboarding');
    // Set default settings
    chrome.storage.local.set({
      provider: 'openai',
      model: 'gpt-4o-mini',
      enabled: true,
      autoTrigger: false,
      suggestionCount: 3,
      systemPrompt: '',
      onboardingCompleted: false,
    });
    // Open onboarding wizard in a new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') });
  }
  if (details.reason === 'update') {
    // Migrate legacy plaintext apiKey → encrypted apiKeyEnc
    migrateApiKey();
  }
});

// Message handler for content script requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_REPLY') {
    handleGenerateReply(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // async response
  }

  if (message.type === 'GET_SETTINGS') {
    getSettingsWithDecryptedKey()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'CHECK_BLACKLIST') {
    const chatName = message.payload.chatName;
    chrome.storage.local.get(['chatBlacklist'], (result) => {
      const list: string[] = result.chatBlacklist ?? [];
      sendResponse({ blocked: isBlacklisted(chatName, list) });
    });
    return true;
  }

  if (message.type === 'TOGGLE_BLACKLIST') {
    const { chatName, blocked } = message.payload;
    chrome.storage.local.get(['chatBlacklist'], (result) => {
      const list: string[] = result.chatBlacklist ?? [];
      const needle = chatName.toLowerCase();
      let updated: string[];
      if (blocked) {
        updated = list.some((e) => e.toLowerCase() === needle)
          ? list
          : [...list, chatName];
      } else {
        updated = list.filter((e) => e.toLowerCase() !== needle);
      }
      chrome.storage.local.set({ chatBlacklist: updated }, () => {
        sendResponse({ chatBlacklist: updated });
      });
    });
    return true;
  }
});

/** Merge local settings and decrypt apiKeyEnc → apiKey for callers */
async function getSettingsWithDecryptedKey(): Promise<Record<string, unknown>> {
  const settings = await new Promise<Record<string, unknown>>((r) =>
    chrome.storage.local.get(null, r),
  );

  if (settings.apiKeyEnc) {
    try {
      settings.apiKey = await decrypt(settings.apiKeyEnc as string);
    } catch (err) {
      console.error('[TG-AI] Failed to decrypt apiKey:', err);
      settings.apiKey = '';
    }
  }

  // Strip internal crypto fields
  delete settings.apiKeyEnc;
  delete settings._cryptoKey;

  return settings;
}

async function handleGenerateReply(payload: {
  messages: Array<{ author: string; text: string; timestamp: string }>;
  chatName: string;
  chatType: string;
}): Promise<{ suggestions: string[] } | { error: string }> {
  // Check blacklist before generating suggestions
  const blResult = await new Promise<{ chatBlacklist: string[] }>((resolve) => {
    chrome.storage.local.get(['chatBlacklist'], (r) => resolve(r as { chatBlacklist: string[] }));
  });
  const blacklist: string[] = blResult.chatBlacklist ?? [];
  if (isBlacklisted(payload.chatName, blacklist)) {
    return { error: 'Chat is blacklisted' };
  }

  // TODO: implement AI provider calls (Epic 4)
  console.log('[TG-AI] Generate reply request:', payload);
  return {
    suggestions: [
      'Подсказка 1 (заглушка)',
      'Подсказка 2 (заглушка)',
      'Подсказка 3 (заглушка)',
    ],
  };
}

// ---- Streaming Port handler (E4-009) ----
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== STREAM_PORT_NAME) return;
  console.log('[TG-AI] Streaming port connected');
  port.onMessage.addListener(async (msg: StreamRequest) => {
    if (msg.type !== 'STREAM_REQUEST') return;
    console.log('[TG-AI] Stream request:', msg.payload.chatName);
    await streamOverPort(port, handleStreamReply, msg.payload);
  });
  port.onDisconnect.addListener(() => {
    console.log('[TG-AI] Streaming port disconnected');
  });
});

async function handleStreamReply(
  context: ChatContext,
  onDelta: StreamCallback,
): Promise<string> {
  console.log('[TG-AI] Streaming reply for:', context.chatName);
  const stub = 'Привет! Как дела?';
  for (const char of stub) {
    if (onDelta(char) === false) return stub;
    await new Promise((r) => setTimeout(r, 30));
  }
  return stub;
}

