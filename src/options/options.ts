// Options page script — save/load settings
// API key is encrypted via AES-GCM before storage

import { encrypt, decrypt } from '../lib/crypto';

const fields = {
  provider: document.getElementById('provider') as HTMLSelectElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  model: document.getElementById('model') as HTMLSelectElement,
  baseUrl: document.getElementById('baseUrl') as HTMLInputElement,
  systemPrompt: document.getElementById('systemPrompt') as HTMLTextAreaElement,
  suggestionCount: document.getElementById('suggestionCount') as HTMLSelectElement,
};

// Load settings — decrypt apiKeyEnc for display
chrome.storage.local.get(null, async (settings) => {
  if (settings.provider) fields.provider.value = settings.provider;
  if (settings.model) fields.model.value = settings.model;
  if (settings.baseUrl) fields.baseUrl.value = settings.baseUrl;
  if (settings.systemPrompt) fields.systemPrompt.value = settings.systemPrompt;
  if (settings.suggestionCount) fields.suggestionCount.value = String(settings.suggestionCount);

  // Decrypt API key for the input field
  if (settings.apiKeyEnc) {
    try {
      fields.apiKey.value = await decrypt(settings.apiKeyEnc);
    } catch {
      console.error('[TG-AI] Failed to decrypt API key');
      fields.apiKey.value = '';
    }
  }
});

// Save
document.getElementById('saveBtn')!.addEventListener('click', () => {
  chrome.storage.local.set(
    {
      provider: fields.provider.value,
      apiKey: fields.apiKey.value,
      model: fields.model.value,
      baseUrl: fields.baseUrl.value,
      systemPrompt: fields.systemPrompt.value,
      suggestionCount: Number(fields.suggestionCount.value),
    },
    () => {
      const btn = document.getElementById('saveBtn')!;
      btn.textContent = '✓ Сохранено';
      setTimeout(() => {
        btn.textContent = 'Сохранить';
      }, 1500);
    },
  );
});
