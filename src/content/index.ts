// Content Script — telegram-ai-assistant
// Injected into web.telegram.org, handles DOM parsing and UI injection

import { getCurrentChatIdentity } from '@/lib/telegram';
import type { ChatIdentity } from '@/lib/types';

let currentChat: ChatIdentity | null = null;

console.log('[TG-AI] Content script loaded on', window.location.href);

function init(): void {
  if (!window.location.hostname.includes('web.telegram.org')) {
    return;
  }
  console.log('[TG-AI] Initializing on Telegram Web...');
  injectUI();
  observeChat();
  detectChatChange();
  watchHashChanges();
}

/** Detect current chat from URL hash + DOM header and log it. */
function detectChatChange(): void {
  const header = document.querySelector('.chat-info, .top, .TopBar');
  const identity = getCurrentChatIdentity(window.location.href, header);

  if (identity.id !== currentChat?.id || identity.name !== currentChat?.name) {
    currentChat = identity;
    console.log('[TG-AI] Chat changed:', currentChat);
  }
}

/** Listen for URL hash changes (user navigating between chats). */
function watchHashChanges(): void {
  window.addEventListener('hashchange', () => {
    detectChatChange();
  });

  // Also observe the header area for SPA-style navigation (no hash change)
  const topbar = document.querySelector('.chat-info, .top, .TopBar, #column-center');
  if (topbar) {
    const headerObserver = new MutationObserver(() => {
      detectChatChange();
    });
    headerObserver.observe(topbar, { childList: true, subtree: true, characterData: true });
    console.log('[TG-AI] Header MutationObserver attached');
  }
}

/** Get the current chat identity (exposed for other modules). */
export function getChatIdentity(): ChatIdentity | null {
  return currentChat;
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
  // TODO: Epic 3 — real DOM parsing
  const observer = new MutationObserver((_mutations) => {
    // Will detect new messages and trigger AI suggestions
  });

  // Observe the chat messages container when it appears
  const chatContainer = document.querySelector('.messages-container');
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
