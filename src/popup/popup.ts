// Popup script — toggle settings + onboarding status

const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const autoToggle = document.getElementById('autoToggle') as HTMLInputElement;
const statusDot = document.getElementById('statusDot')!;
const statusText = document.getElementById('statusText')!;
const setupBanner = document.getElementById('setupBanner');

function hasApiKey(settings: Record<string, unknown>): boolean {
  const provider = (settings.provider as string) ?? 'openai';
  if (provider === 'ollama') return true;
  return !!(settings.apiKey);
}

function updateStatus(enabled: boolean, settings: Record<string, unknown>): void {
  const onboarded = settings.onboardingCompleted as boolean;
  const keyOk = hasApiKey(settings);

  if (!onboarded || !keyOk) {
    statusDot.className = 'status-dot unconfigured';
    statusText.textContent = '\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430';
    if (setupBanner) setupBanner.style.display = 'block';
  } else if (!enabled) {
    statusDot.className = 'status-dot inactive';
    statusText.textContent = '\u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043e';
    if (setupBanner) setupBanner.style.display = 'none';
  } else {
    statusDot.className = 'status-dot active';
    statusText.textContent = '\u0410\u043a\u0442\u0438\u0432\u0435\u043d \u043d\u0430 web.telegram.org';
    if (setupBanner) setupBanner.style.display = 'none';
  }
}

let cachedSettings: Record<string, unknown> = {};

chrome.storage.local.get(null, (result) => {
  cachedSettings = result;
  enabledToggle.checked = (result.enabled as boolean) ?? true;
  autoToggle.checked = (result.autoTrigger as boolean) ?? false;
  updateStatus(enabledToggle.checked, result);
});

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

setupBanner?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') });
});
