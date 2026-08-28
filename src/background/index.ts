// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import type { AuthData } from '../lib/types';

console.log('[TG-AI] Background service worker started');

/** In-memory auth cache (lost on SW restart; persistent copy in storage.session) */
let cachedAuth: AuthData | null = null;

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

  if (message.type === 'AUTH_EXTRACTED') {
    handleAuthExtracted(message.payload as AuthData)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_AUTH_STATUS') {
    getAuthStatus()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

/** Store auth data received from content script */
async function handleAuthExtracted(authData: AuthData): Promise<void> {
  cachedAuth = authData;

  // Persist to chrome.storage.session (survives SW restarts within browser session)
  // Falls back to chrome.storage.local if session is unavailable
  const storage = chrome.storage.session ?? chrome.storage.local;
  await storage.set({ authData });

  console.log('[TG-AI] Auth data stored:', {
    authenticated: authData.authenticated,
    version: authData.version,
    userId: authData.userId,
    dcId: authData.dcId,
    sourceCount: authData.sources.length,
    screenLocked: authData.screenLocked,
    accounts: authData.accounts,
  });
}

/** Retrieve current auth status */
async function getAuthStatus(): Promise<AuthData | null> {
  if (cachedAuth) return cachedAuth;

  // Try to restore from persistent storage
  const storage = chrome.storage.session ?? chrome.storage.local;
  const result = await storage.get('authData');
  if (result.authData) {
    cachedAuth = result.authData as AuthData;
    return cachedAuth;
  }

  return null;
}

async function handleGenerateReply(payload: {
  messages: Array<{ author: string; text: string; timestamp: string }>;
  chatName: string;
  chatType: string;
}): Promise<{ suggestions: string[] } | { error: string }> {
  // TODO: implement AI provider calls (Epic 4)
  console.log('[TG-AI] Generate reply request:', payload);
  return {
    suggestions: ['Подсказка 1 (заглушка)', 'Подсказка 2 (заглушка)', 'Подсказка 3 (заглушка)'],
  };
}
