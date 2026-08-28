// Options page script — save/load settings

const fields = {
  provider: document.getElementById('provider') as HTMLSelectElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  model: document.getElementById('model') as HTMLInputElement,
  baseUrl: document.getElementById('baseUrl') as HTMLInputElement,
  systemPrompt: document.getElementById('systemPrompt') as HTMLTextAreaElement,
  suggestionCount: document.getElementById('suggestionCount') as HTMLSelectElement,
};

// Load settings
chrome.storage.local.get(null, (settings) => {
  if (settings.provider) fields.provider.value = settings.provider;
  if (settings.apiKey) fields.apiKey.value = settings.apiKey;
  if (settings.model) fields.model.value = settings.model;
  if (settings.baseUrl) fields.baseUrl.value = settings.baseUrl;
  if (settings.systemPrompt) fields.systemPrompt.value = settings.systemPrompt;
  if (settings.suggestionCount) fields.suggestionCount.value = String(settings.suggestionCount);
});

// Save
document.getElementById('saveBtn')!.addEventListener('click', () => {
  chrome.storage.local.set({
    provider: fields.provider.value,
    apiKey: fields.apiKey.value,
    model: fields.model.value,
    baseUrl: fields.baseUrl.value,
    systemPrompt: fields.systemPrompt.value,
    suggestionCount: Number(fields.suggestionCount.value),
  }, () => {
    const btn = document.getElementById('saveBtn')!;
    btn.textContent = '✓ Сохранено';
    setTimeout(() => { btn.textContent = 'Сохранить'; }, 1500);
  });
});
