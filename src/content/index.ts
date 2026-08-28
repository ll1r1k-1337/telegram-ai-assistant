// Content Script — telegram-ai-assistant
// Injected into web.telegram.org, handles DOM parsing and UI injection

import { renderChips, clearChips } from './chips';

console.log('[TG-AI] Content script loaded on', window.location.href);

function init(): void {
  if (!window.location.hostname.includes('web.telegram.org')) {
    return;
  }
  console.log('[TG-AI] Initializing on Telegram Web...');
  injectUI();
  observeChat();
}

/** Inject the suggestion panel UI into Telegram's chat area */
function injectUI(): void {
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

  // Close button hides the panel
  const closeBtn = container.querySelector<HTMLElement>('.tg-ai-panel__close');
  closeBtn?.addEventListener('click', () => hideSuggestions());

  console.log('[TG-AI] UI container injected');
}

/**
 * Display AI-generated suggestions as clickable chips.
 * Called when the AI provider returns reply variants.
 */
export function showSuggestions(suggestions: string[]): void {
  const panel = document.querySelector<HTMLElement>('.tg-ai-panel');
  if (!panel) return;

  panel.style.display = '';
  renderChips(suggestions, (text, _index) => {
    console.log('[TG-AI] Chip selected:', text);
    // E6-004 will handle insertion into the input field
  });
}

/** Hide the panel and clear chips */
export function hideSuggestions(): void {
  clearChips();
  const panel = document.querySelector<HTMLElement>('.tg-ai-panel');
  if (panel) {
    panel.style.display = 'none';
  }
}

/** Watch for new messages via MutationObserver */
function observeChat(): void {
  // TODO: Epic 3 — real DOM parsing
  const observer = new MutationObserver((_mutations) => {
    // Will detect new messages and trigger AI suggestions
  });

  const chatContainer = document.querySelector('.messages-container');
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
    console.log('[TG-AI] MutationObserver attached to chat');
  } else {
    setTimeout(observeChat, 2000);
  }
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
