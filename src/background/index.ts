// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import type { ChatContext } from '../lib/types';
import { getToneInstruction } from '../lib/prompts/tone';

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
  chatType: ChatContext['chatType'];
}): Promise<{ suggestions: string[] } | { error: string }> {
  // Adapt tone to chat type (E5-002)
  const toneSnippet = getToneInstruction(payload.chatType);
  console.log('[TG-AI] Tone:', toneSnippet.split('\n')[0]);

  // TODO: implement AI provider calls (Epic 4)
  // Pass toneSnippet as part of the system prompt when calling the AI provider.
  console.log('[TG-AI] Generate reply request:', payload);
  return {
    suggestions: [
      'Подсказка 1 (заглушка)',
      'Подсказка 2 (заглушка)',
      'Подсказка 3 (заглушка)',
    ],
  };
}
