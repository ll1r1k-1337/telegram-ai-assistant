// Background Service Worker — telegram-ai-assistant
// Handles AI API requests and message passing with content scripts

import type { ChatContext } from '../lib/types';
import { getToneInstruction } from '../lib/prompts/tone';

console.log('[TG-AI] Background service worker started');

/** In-memory auth cache (lost on SW restart; persistent copy in storage.session) */
let cachedAuth: AuthData | null = null;

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
    language,
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

