// Content Script — telegram-ai-assistant
// Injected into web.telegram.org, handles DOM parsing and UI injection

import { renderChips, clearChips } from './chips';

console.log('[TG-AI] Content script loaded on', window.location.href);

// ── Selectors for Telegram Web K ────────────────────────────────────
// K-version (web.telegram.org/k/) is the primary target.
const SELECTORS = {
  /** The outer chat column — visible when a chat is open */
  chat: '.chat',
  /** Compose area wrapper that holds the input */
  chatInput: '.chat-input',
  /** The actual input container with the text field */
  inputMessage: '.input-message-container',
  /** Bubbles scroll container (messages) */
  bubbles: '.bubbles',
  /** Message container inside bubbles */
  bubblesInner: '.bubbles-inner',
  /** Center column that swaps content on chat switches */
  columnCenter: '#column-center',
  /** Messages container (fallback) */
  messagesContainer: '.messages-container',
} as const;

/** Injected root element id */
const ROOT_ID = 'tg-ai-assistant-root';

/** Navigation observer — watches for chat switches */
let _navObserver: MutationObserver | null = null;

/** Last chat URL we injected for — avoids duplicate injections */
let _lastInjectedUrl = '';

// ── DOM helpers ─────────────────────────────────────────────────────

/**
 * Wait for an element to appear in the DOM.
 * Resolves with the element, or null after timeout.
 */
function waitForElement(
  selector: string,
  timeoutMs = 10_000,
): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;

    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Remove any previously injected UI root from the DOM.
 */
function removeExistingRoot(): void {
  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    existing.remove();
    console.log('[TG-AI] Removed previous UI root');
  }
}

// ── UI injection ────────────────────────────────────────────────────

/**
 * Build the suggestion panel DOM tree.
 * Returns the root container element.
 */
function buildPanelDOM(): HTMLDivElement {
  const root = document.createElement('div');
  root.id = ROOT_ID;

  const panel = document.createElement('div');
  panel.className = 'tg-ai-panel';
  // Panel starts hidden (display:none in CSS)

  // Header
  const header = document.createElement('div');
  header.className = 'tg-ai-panel__header';
  const headerTitle = document.createElement('span');
  headerTitle.textContent = '🤖 AI Подсказки';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tg-ai-panel__close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Закрыть панель подсказок');
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('tg-ai-panel--visible');
    panel.style.display = 'none';
  });
  header.appendChild(headerTitle);
  header.appendChild(closeBtn);

  // Suggestions container
  const suggestions = document.createElement('div');
  suggestions.className = 'tg-ai-panel__suggestions';
  suggestions.setAttribute('role', 'listbox');
  suggestions.setAttribute('aria-label', 'Варианты ответа');

  // Trigger button
  const trigger = document.createElement('button');
  trigger.className = 'tg-ai-panel__trigger';
  trigger.type = 'button';
  trigger.textContent = '💡 Подсказать ответ';
  trigger.addEventListener('click', () => {
    const isVisible = panel.classList.contains('tg-ai-panel--visible');
    if (isVisible) {
      panel.classList.remove('tg-ai-panel--visible');
      panel.style.display = 'none';
    } else {
      panel.style.display = '';
      panel.classList.add('tg-ai-panel--visible');
    }
  });

  panel.appendChild(header);
  panel.appendChild(suggestions);
  panel.appendChild(trigger);
  root.appendChild(panel);

  return root;
}

/**
 * Inject the suggestion panel UI into Telegram's chat area.
 *
 * Strategy: find the compose/input area (`.chat-input`) and insert
 * the panel container as a sibling directly above it, so it sits
 * between the message bubbles and the compose box.
 *
 * Fallback: if the compose area is not found (e.g. channel without
 * write access), append to the chat column or document.body.
 */
async function injectUI(): Promise<void> {
  // Avoid duplicate injection for the same chat view
  const currentUrl = window.location.href;
  if (currentUrl === _lastInjectedUrl && document.getElementById(ROOT_ID)) {
    console.log('[TG-AI] UI already injected for this view, skipping');
    return;
  }

  // Clean up any previous injection
  removeExistingRoot();

  const root = buildPanelDOM();

  // Strategy 1: anchor above the chat input area
  const chatInput = await waitForElement(SELECTORS.chatInput, 5_000);
  if (chatInput?.parentElement) {
    chatInput.parentElement.insertBefore(root, chatInput);
    console.log('[TG-AI] UI container injected above chat-input');
    _lastInjectedUrl = currentUrl;
    return;
  }

  // Strategy 2: append to the chat column
  const chat = document.querySelector(SELECTORS.chat);
  if (chat) {
    chat.appendChild(root);
    console.log('[TG-AI] UI container injected into .chat (fallback)');
    _lastInjectedUrl = currentUrl;
    return;
  }

  // Strategy 3: body fallback (original behavior)
  document.body.appendChild(root);
  console.log('[TG-AI] UI container injected into body (last resort)');
  _lastInjectedUrl = currentUrl;
}

// ── SPA navigation detection ────────────────────────────────────────

/**
 * Observe Telegram's SPA navigation.
 *
 * Telegram Web K is a single-page app — switching chats doesn't reload
 * the page. We detect navigation by:
 * 1. Watching for URL hash/path changes (popstate, hashchange)
 * 2. MutationObserver on the center column for structural changes
 *    (chat open/close, switching between chats)
 */
function observeNavigation(): void {
  // URL-based detection
  const onNavigate = (): void => {
    const currentUrl = window.location.href;
    if (currentUrl !== _lastInjectedUrl) {
      console.log('[TG-AI] Navigation detected, re-injecting UI');
      void injectUI();
    }
  };

  window.addEventListener('popstate', onNavigate);
  window.addEventListener('hashchange', onNavigate);

  // DOM-based detection: watch for the chat column being swapped
  const startChatObserver = (): void => {
    const target =
      document.querySelector(SELECTORS.columnCenter) ?? document.body;

    _navObserver?.disconnect();
    _navObserver = new MutationObserver(() => {
      // If our root was removed (chat switch destroyed the parent),
      // re-inject after a tick to let Telegram finish its DOM update
      if (!document.getElementById(ROOT_ID)) {
        setTimeout(() => void injectUI(), 100);
      }
    });

    _navObserver.observe(target, { childList: true, subtree: true });
  };

  // Start observing once the center column exists
  void waitForElement(SELECTORS.columnCenter, 15_000).then(
    () => startChatObserver(),
  );
}

// ── Chat message observation ────────────────────────────────────────

/** Watch for new messages via MutationObserver */
async function observeChat(): Promise<void> {
  // Try multiple selectors for the messages container
  const container =
    document.querySelector(SELECTORS.bubblesInner) ??
    document.querySelector(SELECTORS.bubbles) ??
    document.querySelector(SELECTORS.messagesContainer);

  if (container) {
    const observer = new MutationObserver((_mutations) => {
      // Will detect new messages and trigger AI suggestions
      // (implemented by other epics — E3, E5)
    });
    observer.observe(container, { childList: true, subtree: true });
    console.log('[TG-AI] MutationObserver attached to chat messages');
  } else {
    // Retry — Telegram's DOM loads progressively
    const el = await waitForElement(
      [SELECTORS.bubblesInner, SELECTORS.bubbles, SELECTORS.messagesContainer].join(', '),
      8_000,
    );
    if (el) {
      const observer = new MutationObserver((_mutations) => {
        // Placeholder for E3/E5 integration
      });
      observer.observe(el, { childList: true, subtree: true });
      console.log('[TG-AI] MutationObserver attached to chat (deferred)');
    } else {
      console.warn('[TG-AI] Could not find message container');
    }
  }
}

// ── Init ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  if (!window.location.hostname.includes('web.telegram.org')) {
    return;
  }
  console.log('[TG-AI] Initializing on Telegram Web...');

  await injectUI();
  observeNavigation();
  await observeChat();

  console.log('[TG-AI] Initialization complete');
}

/**
 * Display AI-generated suggestions as clickable chips.
 * Called when the AI provider returns reply variants.
 */
export function showSuggestions(suggestions: string[]): void {
  const panel = document.querySelector<HTMLElement>('.tg-ai-panel');
  if (!panel) return;

  panel.style.display = '';
  panel.classList.add('tg-ai-panel--visible');
  renderChips(suggestions, (text, _index) => {
    console.log('[TG-AI] Chip selected:', text);
    // E6-004 handles insertion into the input field
  });
}

/** Hide the panel and clear chips */
export function hideSuggestions(): void {
  clearChips();
  const panel = document.querySelector<HTMLElement>('.tg-ai-panel');
  if (panel) {
    panel.style.display = 'none';
    panel.classList.remove('tg-ai-panel--visible');
  }
}

// ── Bootstrap ───────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
