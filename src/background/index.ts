// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import { clampSuggestionCount } from '../lib/types';

console.log('[TG-AI] Background service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[TG-AI] Extension installed');
    // Set default settings
    chrome.storage.local.set({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: '',
      enabled: true,
      autoTrigger: false,
      suggestionCount: 3,
      systemPrompt: '',
    });
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
    chrome.storage.local.get(null, (settings) => {
      sendResponse(settings);
    });
    return true;
  }
});

async function handleGenerateReply(payload: {
  messages: Array<{ author: string; text: string; timestamp: string }>;
  chatName: string;
  chatType: string;
}): Promise<{ suggestions: string[] } | { error: string }> {
  // Read user-configured suggestion count from storage (clamped to 1-5)
  const count = await new Promise<number>((resolve) => {
    chrome.storage.local.get('suggestionCount', (r) => {
      resolve(clampSuggestionCount(r.suggestionCount));
    });
  });

  // TODO: implement AI provider calls (Epic 4)
  console.log('[TG-AI] Generate reply request:', payload);
  const suggestions = Array.from({ length: count }, (_, i) =>
    `Подсказка ${i + 1} (заглушка)`
  );
  return { suggestions };
}
