// Popup script — toggle settings

const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const autoToggle = document.getElementById('autoToggle') as HTMLInputElement;
const statusDot = document.getElementById('statusDot')!;
const statusText = document.getElementById('statusText')!;

// Load current settings
chrome.storage.local.get(['enabled', 'autoTrigger'], (result) => {
  enabledToggle.checked = result.enabled ?? true;
  autoToggle.checked = result.autoTrigger ?? false;
  updateStatus(enabledToggle.checked);
});

enabledToggle.addEventListener('change', () => {
  const enabled = enabledToggle.checked;
  chrome.storage.local.set({ enabled });
  updateStatus(enabled);
});

autoToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoTrigger: autoToggle.checked });
});

function updateStatus(enabled: boolean): void {
  statusDot.className = `status-dot ${enabled ? 'active' : 'inactive'}`;
  statusText.textContent = enabled ? 'Активен на web.telegram.org' : 'Отключено';
}
