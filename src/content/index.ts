// Content Script — telegram-ai-assistant
// Injected into web.telegram.org, handles DOM parsing and UI injection

import { extractAuth } from './auth-extractor';

console.log('[TG-AI] Content script loaded on', window.location.href);

function init(): void {
  if (!window.location.hostname.includes('web.telegram.org')) {
    return;
  }
  console.log('[TG-AI] Initializing on Telegram Web...');
  injectUI();
  observeChat();
  initAuth();
}

/** Run auth extraction and send result to background SW */
async function initAuth(): Promise<void> {
  try {
    const authData = await extractAuth();
    chrome.runtime.sendMessage({ type: 'AUTH_EXTRACTED', payload: authData });
    console.log(
      '[TG-AI] Auth data sent to background:',
      authData.authenticated ? 'authenticated' : 'not authenticated',
    );
  } catch (err) {
    console.error('[TG-AI] Auth extraction failed:', err);
  }
}

/** Inject the suggestion panel UI into Telegram's chat area */
function injectUI(): void {
  // TODO: Epic 6 — full UI injection
  const container = document.createElement('div');
  container.id = 'tg-ai-assistant-root';
  container.innerHTML = `
    <div class="tg-ai-panel" style="display:none;">
      <div class="tg-ai-panel__header">
        <span>🤖 AI Подсказки</span>
        <button class="tg-ai-panel__close">&times;</button>
      </div>
      <div class="tg-ai-panel__suggestions"></div>
      <button class="tg-ai-panel__trigger">💡 Подсказать ответ</button>
    </div>
  `;
  document.body.appendChild(container);
  console.log('[TG-AI] UI container injected');
}

/** Watch for new messages via MutationObserver */
function observeChat(): void {
  const observer = new MutationObserver((_mutations) => {
    // Extract latest messages on each DOM change (debounced via rAF)
    const messages = getLastMessages(15);
    if (messages.length > 0) {
      console.log(`[TG-AI] Parsed ${messages.length} messages from DOM`);
    }
  });

  // Observe the chat messages container when it appears
  const chatContainer = findMessagesContainer();
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
    console.log('[TG-AI] MutationObserver attached to chat');
  } else {
    // Retry when Telegram finishes loading
    setTimeout(observeChat, 2000);
  }
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
