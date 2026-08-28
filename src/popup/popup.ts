// Popup script — toggle settings + auth status indicator

const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const autoToggle = document.getElementById('autoToggle') as HTMLInputElement;
const statusDot = document.getElementById('statusDot')!;
const statusText = document.getElementById('statusText')!;
const statusProvider = document.getElementById('statusProvider')!;

/** Provider display names */
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
  custom: 'Custom',
};

/** Check if API key is configured (encrypted or plaintext) */
function hasApiKey(settings: Record<string, unknown>): boolean {
  const provider = (settings.provider as string) ?? 'openai';
  // Ollama doesn't need an API key
  if (provider === 'ollama') return true;
  return !!(settings.apiKeyEnc || settings.apiKey);
}

/** Update status dot + text based on enabled state and auth */
function updateStatus(enabled: boolean, settings: Record<string, unknown>): void {
  const provider = (settings.provider as string) ?? 'openai';
  const keyOk = hasApiKey(settings);

  if (!enabled) {
    statusDot.className = 'status-dot inactive';
    statusText.textContent = 'Отключено';
    statusProvider.textContent = '';
  } else if (!keyOk) {
    statusDot.className = 'status-dot unconfigured';
    statusText.textContent = 'API-ключ не настроен';
    statusProvider.textContent = PROVIDER_LABELS[provider] ?? provider;
  } else {
    statusDot.className = 'status-dot active';
    statusText.textContent = 'Активен на web.telegram.org';
    statusProvider.textContent = PROVIDER_LABELS[provider] ?? provider;
  }
}

/** Cached settings for toggle handler */
let cachedSettings: Record<string, unknown> = {};

// Load current settings
chrome.storage.local.get(null, (result) => {
  cachedSettings = result;
  enabledToggle.checked = result.enabled ?? true;
  autoToggle.checked = result.autoTrigger ?? false;
  updateStatus(enabledToggle.checked, result);
});

// React to settings changes from options page
chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    cachedSettings[key] = newValue;
  }
  enabledToggle.checked = (cachedSettings.enabled as boolean) ?? true;
  autoToggle.checked = (cachedSettings.autoTrigger as boolean) ?? false;
  updateStatus(enabledToggle.checked, cachedSettings);
});

enabledToggle.addEventListener('change', () => {
  const enabled = enabledToggle.checked;
  chrome.storage.local.set({ enabled });
  cachedSettings.enabled = enabled;
  updateStatus(enabled, cachedSettings);
});

autoToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoTrigger: autoToggle.checked });
});
