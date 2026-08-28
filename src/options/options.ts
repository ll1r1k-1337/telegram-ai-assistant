// Options page script — save/load settings
// API key is encrypted via AES-GCM before storage

import { encrypt, decrypt } from '../lib/crypto';

const fields = {
  provider: document.getElementById('provider') as HTMLSelectElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  model: document.getElementById('model') as HTMLInputElement,
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

// Save — encrypt apiKey before storing
document.getElementById('saveBtn')!.addEventListener('click', async () => {
  const btn = document.getElementById('saveBtn')!;
  btn.textContent = '⏳ Сохранение...';
  btn.setAttribute('disabled', '');

  try {
    const apiKeyPlain = fields.apiKey.value.trim();
    const toStore: Record<string, unknown> = {
      provider: fields.provider.value,
      model: fields.model.value,
      baseUrl: fields.baseUrl.value,
      systemPrompt: fields.systemPrompt.value,
      suggestionCount: Number(fields.suggestionCount.value),
    };

    if (apiKeyPlain) {
      toStore.apiKeyEnc = await encrypt(apiKeyPlain);
    } else {
      toStore.apiKeyEnc = '';
    }

    await chrome.storage.local.set(toStore);
    // Clean up any legacy plaintext key
    await chrome.storage.local.remove('apiKey');

    btn.textContent = '✓ Сохранено';
    setTimeout(() => {
      btn.textContent = 'Сохранить';
      btn.removeAttribute('disabled');
    }, 1500);
  } catch (err) {
    console.error('[TG-AI] Save error:', err);
    btn.textContent = '✗ Ошибка';
    setTimeout(() => {
      btn.textContent = 'Сохранить';
      btn.removeAttribute('disabled');
    }, 2000);
  }
});
