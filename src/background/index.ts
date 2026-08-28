// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import { decrypt, migrateApiKey } from '../lib/crypto';

console.log('[TG-AI] Background service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[TG-AI] Extension installed');
    // Set default settings (no apiKey until user configures one)
    chrome.storage.local.set({
      provider: 'openai',
      model: 'gpt-4o-mini',
      enabled: true,
      autoTrigger: false,
      suggestionCount: 3,
      systemPrompt: '',
    });
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
