import { clampSuggestionCount } from '../lib/types';
// Options page script — save/load settings

/** Per-provider model suggestions */
const MODEL_HINTS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
  ollama: ['llama3.1', 'mistral', 'gemma2', 'qwen2.5'],
  custom: ['gpt-4o-mini'],
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  ollama: 'llama3.1',
  custom: 'gpt-4o-mini',
};

const DEFAULT_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434/v1',
  custom: '',
};

const DEFAULTS: Omit<Settings, 'baseUrl'> & { baseUrl: string } = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  baseUrl: '',
  enabled: true,
  autoTrigger: false,
  suggestionCount: 3,
  systemPrompt: '',
};

// DOM refs
const el = {
  provider: document.getElementById('provider') as HTMLSelectElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  apiKeyGroup: document.getElementById('apiKeyGroup') as HTMLDivElement,
  toggleApiKey: document.getElementById('toggleApiKey') as HTMLButtonElement,
  model: document.getElementById('model') as HTMLInputElement,
  modelHints: document.getElementById('modelHints') as HTMLDivElement,
  baseUrl: document.getElementById('baseUrl') as HTMLInputElement,
  baseUrlGroup: document.getElementById('baseUrlGroup') as HTMLDivElement,
  systemPrompt: document.getElementById('systemPrompt') as HTMLTextAreaElement,
  promptChars: document.getElementById('promptChars') as HTMLSpanElement,
  suggestionCount: document.getElementById('suggestionCount') as HTMLSelectElement,
  enabledToggle: document.getElementById('enabledToggle') as HTMLInputElement,
  autoToggle: document.getElementById('autoToggle') as HTMLInputElement,
  saveBtn: document.getElementById('saveBtn') as HTMLButtonElement,
  resetBtn: document.getElementById('resetBtn') as HTMLButtonElement,
  testBtn: document.getElementById('testBtn') as HTMLButtonElement,
  toast: document.getElementById('toast') as HTMLDivElement,
};

// ── Toast ──────────────────────────────────────────────
function showToast(msg: string, ok: boolean): void {
  el.toast.textContent = msg;
  el.toast.className = `toast show ${ok ? 'toast-success' : 'toast-error'}`;
  setTimeout(() => { el.toast.classList.remove('show'); }, 2500);
}

// ── Conditional fields ─────────────────────────────────
function updateConditionalUI(): void {
  const p = el.provider.value;
  // API key: hide for ollama
  el.apiKeyGroup.classList.toggle('hidden', p === 'ollama');
  // Base URL: show for ollama & custom
  el.baseUrlGroup.classList.toggle('hidden', p !== 'ollama' && p !== 'custom');
  // Model hints
  renderModelHints(p);
}

function renderModelHints(provider: string): void {
  const hints = MODEL_HINTS[provider] ?? [];
  el.modelHints.innerHTML = '';
  for (const m of hints) {
    const chip = document.createElement('span');
    chip.className = 'model-hint';
    chip.textContent = m;
    chip.addEventListener('click', () => { el.model.value = m; });
    el.modelHints.appendChild(chip);
  }
}

// ── Load settings ──────────────────────────────────────
function loadSettings(): void {
  chrome.storage.local.get(null, (s: Record<string, unknown>) => {
    el.provider.value = (s['provider'] as string) || DEFAULTS.provider;
    el.apiKey.value = (s['apiKey'] as string) || '';
    el.model.value = (s['model'] as string) || DEFAULT_MODELS[el.provider.value] || '';
    el.baseUrl.value = (s['baseUrl'] as string) || '';
    el.systemPrompt.value = (s['systemPrompt'] as string) || '';
    el.suggestionCount.value = String(s['suggestionCount'] ?? DEFAULTS.suggestionCount);
    el.enabledToggle.checked = (s['enabled'] as boolean) ?? DEFAULTS.enabled;
    el.autoToggle.checked = (s['autoTrigger'] as boolean) ?? DEFAULTS.autoTrigger;
    updatePromptCounter();
    updateConditionalUI();
  });
}

// ── Save settings ──────────────────────────────────────
function saveSettings(): void {
  const provider = el.provider.value as Settings['provider'];

  // Validate
  if (provider !== 'ollama' && !el.apiKey.value.trim()) {
    el.apiKey.classList.add('invalid');
    showToast('Введите API ключ', false);
    el.apiKey.focus();
    return;
  }
  if (!el.model.value.trim()) {
    el.model.classList.add('invalid');
    showToast('Укажите модель', false);
    el.model.focus();
    return;
  }
  if ((provider === 'ollama' || provider === 'custom') && !el.baseUrl.value.trim()) {
    el.baseUrl.classList.add('invalid');
    showToast('Укажите Base URL', false);
    el.baseUrl.focus();
    return;
  }

  const data: Record<string, unknown> = {
    provider,
    apiKey: el.apiKey.value.trim(),
    model: el.model.value.trim(),
    baseUrl: el.baseUrl.value.trim(),
    enabled: el.enabledToggle.checked,
    autoTrigger: el.autoToggle.checked,
    suggestionCount: Number(el.suggestionCount.value),
    systemPrompt: el.systemPrompt.value,
  };

  el.saveBtn.disabled = true;
  chrome.storage.local.set(data, () => {
    showToast('✓ Настройки сохранены', true);
    el.saveBtn.disabled = false;
    // Notify background/content
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload: data });
  });
}

// ── Reset to defaults ──────────────────────────────────
function resetSettings(): void {
  el.provider.value = DEFAULTS.provider;
  el.apiKey.value = '';
  el.model.value = DEFAULT_MODELS[DEFAULTS.provider];
  el.baseUrl.value = '';
  el.systemPrompt.value = '';
  el.suggestionCount.value = String(DEFAULTS.suggestionCount);
  el.enabledToggle.checked = DEFAULTS.enabled;
  el.autoToggle.checked = DEFAULTS.autoTrigger;
  updatePromptCounter();
  updateConditionalUI();
  showToast('Настройки сброшены (не сохранены)', true);
}

// ── Test connection ────────────────────────────────────
async function testConnection(): Promise<void> {
  el.testBtn.disabled = true;
  el.testBtn.textContent = '⏳ Проверяю...';

  const provider = el.provider.value;
  const apiKey = el.apiKey.value.trim();
  const model = el.model.value.trim();
  const baseUrl = el.baseUrl.value.trim();

  try {
    let url = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: string | undefined;

    if (provider === 'openai' || provider === 'custom') {
      url = (provider === 'custom' && baseUrl ? baseUrl : 'https://api.openai.com/v1') + '/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
    } else if (provider === 'ollama') {
      url = (baseUrl || 'http://localhost:11434/v1') + '/chat/completions';
      body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
    }

    const resp = await fetch(url, { method: 'POST', headers, body });
    if (resp.ok) {
      showToast('✓ Соединение успешно!', true);
    } else {
      const data = await resp.json().catch(() => ({}));
      const errMsg = (data as Record<string, Record<string, string>>)?.error?.message || resp.statusText;
      showToast(`✗ ${resp.status}: ${errMsg}`, false);
    }
  } catch (e) {
    showToast(`✗ Ошибка: ${(e as Error).message}`, false);
  } finally {
    el.testBtn.disabled = false;
    el.testBtn.textContent = '🔌 Проверить соединение';
  }
}

// ── Prompt char counter ────────────────────────────────
function updatePromptCounter(): void {
  el.promptChars.textContent = String(el.systemPrompt.value.length);
}

// ── Event listeners ────────────────────────────────────
el.provider.addEventListener('change', () => {
  const p = el.provider.value;
  // Auto-fill model & base URL on provider change
  el.model.value = DEFAULT_MODELS[p] ?? '';
  el.baseUrl.value = DEFAULT_URLS[p] ?? '';
  el.model.placeholder = DEFAULT_MODELS[p] ?? '';
  updateConditionalUI();
});

// Save
document.getElementById('saveBtn')!.addEventListener('click', () => {
  chrome.storage.local.set({
    provider: fields.provider.value,
    apiKey: fields.apiKey.value,
    model: fields.model.value,
    baseUrl: fields.baseUrl.value,
    systemPrompt: fields.systemPrompt.value,
    suggestionCount: clampSuggestionCount(fields.suggestionCount.value),
  }, () => {
    const btn = document.getElementById('saveBtn')!;
    btn.textContent = '✓ Сохранено';
    setTimeout(() => { btn.textContent = 'Сохранить'; }, 1500);
  });
});

// Clear invalid state on input
for (const input of [el.apiKey, el.model, el.baseUrl]) {
  input.addEventListener('input', () => { input.classList.remove('invalid'); });
}

el.systemPrompt.addEventListener('input', updatePromptCounter);
el.saveBtn.addEventListener('click', saveSettings);
el.resetBtn.addEventListener('click', resetSettings);
el.testBtn.addEventListener('click', () => { void testConnection(); });

// Init
loadSettings();
