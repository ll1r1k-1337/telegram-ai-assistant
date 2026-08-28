// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import { isBlacklisted } from '@/lib/blacklist';

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
      chatBlacklist: [],
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
