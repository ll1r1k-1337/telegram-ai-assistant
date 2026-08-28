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
      apiKey: '',
      enabled: true,
      autoTrigger: false,
      suggestionCount: 3,
      systemPrompt: '',
      onboardingCompleted: false,
    });
    // Open onboarding wizard in a new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') });
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

