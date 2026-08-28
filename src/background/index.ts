// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import { detectLanguage } from '../lib/language-detector';

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
}): Promise<{ suggestions: string[]; language: string } | { error: string }> {
  // Auto-detect conversation language from message texts
  const language = detectLanguage(payload.messages.map((m) => m.text));
  console.log('[TG-AI] Detected language:', language);

  // TODO: implement AI provider calls (Epic 4)
  // The detected `language` should be passed in ChatContext so providers
  // can instruct the model to reply in the same language
  console.log('[TG-AI] Generate reply request:', { ...payload, language });
  return {
    suggestions: [
      'Подсказка 1 (заглушка)',
      'Подсказка 2 (заглушка)',
      'Подсказка 3 (заглушка)',
    ],
    language,
  };
}
