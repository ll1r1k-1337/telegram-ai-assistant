// Onboarding wizard — step-by-step first-time setup

const TOTAL_STEPS = 4;
let currentStep = 1;
let selectedProvider = 'openai';

const steps = document.querySelectorAll<HTMLElement>('.step');
const progressFill = document.getElementById('progressFill')!;
const backBtn = document.getElementById('backBtn')!;
const nextBtn = document.getElementById('nextBtn')!;
const stepCounter = document.getElementById('stepCounter')!;
const footer = document.getElementById('wizardFooter')!;

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const baseUrlInput = document.getElementById('baseUrl') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const apiKeyGroup = document.getElementById('apiKeyGroup')!;
const baseUrlGroup = document.getElementById('baseUrlGroup')!;
const configHint = document.getElementById('configHint')!;
const apiKeyError = document.getElementById('apiKeyError')!;

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  ollama: 'llama3.2',
  custom: 'gpt-4o-mini',
};

const DEFAULT_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434/v1',
  custom: 'http://localhost:8080/v1',
};

document.querySelectorAll<HTMLElement>('.provider-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.provider-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedProvider = card.dataset.provider ?? 'openai';
  });
});

function showStep(step: number): void {
  steps.forEach((el) => {
    el.classList.remove('active');
    if (Number(el.dataset.step) === step) el.classList.add('active');
  });
  progressFill.style.width = `${(step / TOTAL_STEPS) * 100}%`;
  stepCounter.textContent = `${step} / ${TOTAL_STEPS}`;
  backBtn.style.visibility = step <= 1 ? 'hidden' : 'visible';

  if (step === 1) {
    nextBtn.textContent = '\u041d\u0430\u0447\u0430\u0442\u044c \u2192';
    nextBtn.disabled = false;
  } else if (step === 3) {
    nextBtn.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u2192';
    nextBtn.disabled = false;
    setupConfigStep();
  } else if (step === TOTAL_STEPS) {
    footer.style.display = 'none';
  } else {
    nextBtn.textContent = '\u0414\u0430\u043b\u0435\u0435 \u2192';
    nextBtn.disabled = false;
  }
  apiKeyError.classList.remove('visible');
}

function setupConfigStep(): void {
  const needsKey = selectedProvider !== 'ollama';
  const needsUrl = selectedProvider === 'ollama' || selectedProvider === 'custom';
  apiKeyGroup.classList.toggle('hidden', !needsKey);
  baseUrlGroup.classList.toggle('hidden', !needsUrl);
  modelInput.placeholder = DEFAULT_MODELS[selectedProvider] ?? 'gpt-4o-mini';
  if (!modelInput.value) modelInput.value = DEFAULT_MODELS[selectedProvider] ?? '';
  if (needsUrl && !baseUrlInput.value) baseUrlInput.value = DEFAULT_URLS[selectedProvider] ?? '';
  const hints: Record<string, string> = {
    openai: '\u041f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u043a\u043b\u044e\u0447 \u043d\u0430 platform.openai.com \u2192 API Keys.',
    anthropic: '\u041f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u043a\u043b\u044e\u0447 \u043d\u0430 console.anthropic.com \u2192 API Keys.',
    ollama: '\u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044c, \u0447\u0442\u043e Ollama \u0437\u0430\u043f\u0443\u0449\u0435\u043d\u0430 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e.',
    custom: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 URL \u0438 \u043a\u043b\u044e\u0447 OpenAI-\u0441\u043e\u0432\u043c\u0435\u0441\u0442\u0438\u043c\u043e\u0433\u043e \u0441\u0435\u0440\u0432\u0435\u0440\u0430.',
  };
  configHint.textContent = hints[selectedProvider] ?? '';
}

function validateConfig(): boolean {
  if (selectedProvider !== 'ollama' && !apiKeyInput.value.trim()) {
    apiKeyError.classList.add('visible');
    apiKeyInput.focus();
    return false;
  }
  apiKeyError.classList.remove('visible');
  return true;
}

function saveSettings(): Promise<void> {
  return new Promise((resolve) => {
    const settings: Record<string, unknown> = {
      provider: selectedProvider,
      model: modelInput.value || DEFAULT_MODELS[selectedProvider] || 'gpt-4o-mini',
      apiKey: apiKeyInput.value.trim(),
      enabled: true,
      autoTrigger: false,
      suggestionCount: 3,
      systemPrompt: '',
      onboardingCompleted: true,
    };
    if (selectedProvider === 'ollama' || selectedProvider === 'custom') {
      settings.baseUrl = baseUrlInput.value.trim() || DEFAULT_URLS[selectedProvider] || '';
    }
    chrome.storage.local.set(settings, resolve);
  });
}

backBtn.addEventListener('click', () => {
  if (currentStep > 1) { currentStep--; showStep(currentStep); }
});

nextBtn.addEventListener('click', async () => {
  if (currentStep === 3) {
    if (!validateConfig()) return;
    nextBtn.disabled = true;
    nextBtn.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...';
    await saveSettings();
  }
  if (currentStep < TOTAL_STEPS) { currentStep++; showStep(currentStep); }
});

document.getElementById('openTelegram')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://web.telegram.org/a/' });
});

apiKeyInput.addEventListener('input', () => { apiKeyError.classList.remove('visible'); });

showStep(1);
