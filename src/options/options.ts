// Options page script — save/load settings + blacklist management

const fields = {
  provider: document.getElementById('provider') as HTMLSelectElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  model: document.getElementById('model') as HTMLInputElement,
  baseUrl: document.getElementById('baseUrl') as HTMLInputElement,
  systemPrompt: document.getElementById('systemPrompt') as HTMLTextAreaElement,
  suggestionCount: document.getElementById('suggestionCount') as HTMLSelectElement,
};

/* --- Blacklist management --- */

const blacklistInput = document.getElementById('blacklistInput') as HTMLInputElement;
const blacklistAddBtn = document.getElementById('addBlacklistBtn')!;
const blacklistListEl = document.getElementById('blacklistList')!;
const blacklistEmptyEl = document.getElementById('blacklistEmpty')!;

let chatBlacklist: string[] = [];

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderBlacklist(): void {
  blacklistListEl.innerHTML = '';
  blacklistEmptyEl.style.display = chatBlacklist.length === 0 ? 'block' : 'none';
  for (const name of chatBlacklist) {
    const li = document.createElement('li');
    li.className = 'blacklist-item';
    li.innerHTML = `
      <span class="name">${escapeHtml(name)}</span>
      <button class="remove-btn" title="Убрать из чёрного списка" data-chat="${escapeHtml(name)}">✕</button>
    `;
    const removeBtn = li.querySelector('button')!;
    removeBtn.addEventListener('click', () => {
      chatBlacklist = chatBlacklist.filter((n) => n !== name);
      renderBlacklist();
    });
    blacklistListEl.appendChild(li);
  }
}

function addBlacklistChat(): void {
  const name = blacklistInput.value.trim();
  if (!name) return;
  const exists = chatBlacklist.some((e) => e.toLowerCase() === name.toLowerCase());
  if (exists) return;
  chatBlacklist.push(name);
  blacklistInput.value = '';
  renderBlacklist();
}

blacklistAddBtn.addEventListener('click', addBlacklistChat);
blacklistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBlacklistChat();
});

// Load settings
chrome.storage.local.get(null, (settings) => {
  if (settings.provider) fields.provider.value = settings.provider;
  if (settings.apiKey) fields.apiKey.value = settings.apiKey;
  if (settings.model) fields.model.value = settings.model;
  if (settings.baseUrl) fields.baseUrl.value = settings.baseUrl;
  if (settings.systemPrompt) fields.systemPrompt.value = settings.systemPrompt;
  if (settings.suggestionCount) fields.suggestionCount.value = String(settings.suggestionCount);

  chatBlacklist = settings.chatBlacklist ?? [];
  renderBlacklist();
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
      chatBlacklist,
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
