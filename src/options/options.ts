// Options page script — provider-aware save/load settings

/** Model presets per provider */
const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (быстрый, дешёвый)' },
    { value: 'gpt-4o', label: 'GPT-4o (мощный)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'o4-mini', label: 'o4-mini (reasoning)' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4 (быстрый)' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (мощный)' },
  ],
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'gemma2', label: 'Gemma 2' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'phi3', label: 'Phi-3' },
  ],
  custom: [],
};

/** Default base URLs */
const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434/v1',
  custom: '',
};

/** Placeholder hints for API key */
const API_KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  ollama: '',
  custom: 'API ключ...',
};

const fields = {
  provider: document.getElementById('provider') as HTMLSelectElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  model: document.getElementById('model') as HTMLSelectElement,
  baseUrl: document.getElementById('baseUrl') as HTMLInputElement,
  systemPrompt: document.getElementById('systemPrompt') as HTMLTextAreaElement,
  suggestionCount: document.getElementById('suggestionCount') as HTMLSelectElement,
};

const apiKeyGroup = document.getElementById('apiKeyGroup')!;
const baseUrlGroup = document.getElementById('baseUrlGroup')!;
const modelHint = document.getElementById('modelHint')!;
const testBtn = document.getElementById('testBtn')!;
const testResult = document.getElementById('testResult')!;
const toggleApiKeyBtn = document.getElementById('toggleApiKey')!;

/** Populate model <select> for the given provider, preserving current value if possible */
function updateModels(provider: string, currentModel?: string): void {
  const models = PROVIDER_MODELS[provider] ?? [];
  fields.model.innerHTML = '';

  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    fields.model.appendChild(opt);
  }

  // Allow free-form model entry for custom/ollama
  if (provider === 'custom' || provider === 'ollama') {
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '— ввести вручную —';
    fields.model.appendChild(customOpt);
  }

  // Restore previous value if it exists in the list
  if (currentModel) {
    const exists = Array.from(fields.model.options).some((o) => o.value === currentModel);
    if (exists) {
      fields.model.value = currentModel;
    } else if (currentModel !== '__custom__') {
      // Add the saved model as a custom option at top
      const opt = document.createElement('option');
      opt.value = currentModel;
      opt.textContent = currentModel;
      fields.model.insertBefore(opt, fields.model.firstChild);
      fields.model.value = currentModel;
    }
  }

  updateModelHint(provider);
}

/** Show/hide fields based on provider */
function updateVisibility(provider: string): void {
  // API key: hidden for Ollama
  apiKeyGroup.classList.toggle('hidden', provider === 'ollama');

  // Base URL: visible only for Ollama and Custom
  baseUrlGroup.classList.toggle('hidden', provider !== 'ollama' && provider !== 'custom');

  // Update API key placeholder
  fields.apiKey.placeholder = API_KEY_PLACEHOLDERS[provider] ?? '';

  // Set default base URL if field is empty
  if (!fields.baseUrl.value && DEFAULT_BASE_URLS[provider]) {
    fields.baseUrl.value = DEFAULT_BASE_URLS[provider];
  }
}

/** Update the model hint text */
function updateModelHint(provider: string): void {
  const hints: Record<string, string> = {
    openai: 'Рекомендуется gpt-4o-mini для баланса скорости и качества.',
    anthropic: 'Рекомендуется Claude Sonnet 4 для баланса скорости и качества.',
    ollama: 'Убедитесь что модель загружена: ollama pull <имя>',
    custom: 'Укажите имя модели, совместимой с OpenAI API.',
  };
  modelHint.textContent = hints[provider] ?? '';
}

/** Handle custom model entry via prompt */
function handleCustomModel(): void {
  if (fields.model.value === '__custom__') {
    const custom = prompt('Введите имя модели:');
    if (custom) {
      const opt = document.createElement('option');
      opt.value = custom;
      opt.textContent = custom;
      fields.model.insertBefore(opt, fields.model.firstChild);
      fields.model.value = custom;
    } else {
      // Revert to first real option
      fields.model.selectedIndex = 0;
    }
  }
}

// --- Event listeners ---

fields.provider.addEventListener('change', () => {
  const provider = fields.provider.value;
  updateVisibility(provider);
  updateModels(provider);
  // Reset base URL to default for new provider
  fields.baseUrl.value = DEFAULT_BASE_URLS[provider] ?? '';
});

fields.model.addEventListener('change', handleCustomModel);

toggleApiKeyBtn.addEventListener('click', () => {
  const isPassword = fields.apiKey.type === 'password';
  fields.apiKey.type = isPassword ? 'text' : 'password';
  toggleApiKeyBtn.textContent = isPassword ? '🙈' : '👁';
});

// Test connection
testBtn.addEventListener('click', async () => {
  testResult.textContent = '⏳ Проверка…';
  testResult.className = 'test-result';

  const provider = fields.provider.value;
  const apiKey = fields.apiKey.value;
  const model = fields.model.value;
  const baseUrl = fields.baseUrl.value || DEFAULT_BASE_URLS[provider];

  try {
    if (provider === 'openai' || provider === 'custom') {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      testResult.textContent = '✓ Подключено';
      testResult.className = 'test-result ok';
    } else if (provider === 'anthropic') {
      const resp = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const err = (body as Record<string, unknown>).error;
        throw new Error(err ? JSON.stringify(err) : `HTTP ${resp.status}`);
      }
      testResult.textContent = '✓ Подключено';
      testResult.className = 'test-result ok';
    } else if (provider === 'ollama') {
      const resp = await fetch(`${baseUrl}/models`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      testResult.textContent = '✓ Ollama доступен';
      testResult.className = 'test-result ok';
    }
  } catch (e) {
    testResult.textContent = `✗ ${(e as Error).message}`;
    testResult.className = 'test-result err';
  }
});

// Load settings
chrome.storage.local.get(null, (settings: Record<string, unknown>) => {
  const provider = (settings.provider as string) ?? 'openai';
  fields.provider.value = provider;
  updateVisibility(provider);
  updateModels(provider, settings.model as string | undefined);

  if (settings.apiKey) fields.apiKey.value = settings.apiKey as string;
  if (settings.baseUrl) fields.baseUrl.value = settings.baseUrl as string;
  if (settings.systemPrompt) fields.systemPrompt.value = settings.systemPrompt as string;
  if (settings.suggestionCount) fields.suggestionCount.value = String(settings.suggestionCount);
});

// Save
document.getElementById('saveBtn')!.addEventListener('click', () => {
  const provider = fields.provider.value;
  chrome.storage.local.set(
    {
      provider,
      apiKey: fields.apiKey.value,
      model: fields.model.value,
      baseUrl: fields.baseUrl.value || DEFAULT_BASE_URLS[provider],
      systemPrompt: fields.systemPrompt.value,
      suggestionCount: Number(fields.suggestionCount.value),
    },
    () => {
      const btn = document.getElementById('saveBtn')!;
      btn.textContent = '✓ Сохранено';
      setTimeout(() => {
        btn.textContent = 'Сохранить';
      }, 1500);

      // Notify background about settings change
      chrome.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        payload: {
          provider,
          apiKey: fields.apiKey.value,
          model: fields.model.value,
          baseUrl: fields.baseUrl.value,
        },
      });
    },
  );
});
