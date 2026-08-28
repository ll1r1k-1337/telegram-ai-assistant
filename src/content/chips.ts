// E6-003: Suggestion chips — render AI reply variants as clickable chips

/** Callback fired when user clicks a chip */
export type ChipClickHandler = (text: string, index: number) => void;

const CHIP_CLASS = 'tg-ai-suggestion';
const CHIP_ACTIVE_CLASS = 'tg-ai-suggestion--active';
const CONTAINER_SELECTOR = '.tg-ai-panel__suggestions';

/**
 * Render an array of reply suggestions as clickable chip elements.
 * Replaces any previously rendered chips in the container.
 */
export function renderChips(
  suggestions: string[],
  onClick: ChipClickHandler,
): HTMLElement[] {
  const container = document.querySelector(CONTAINER_SELECTOR);
  if (!container) {
    console.warn('[TG-AI] Suggestions container not found');
    return [];
  }

  // Clear previous chips
  container.innerHTML = '';

  const chips = suggestions.map((text, index) => {
    const chip = document.createElement('button');
    chip.className = CHIP_CLASS;
    chip.type = 'button';
    chip.textContent = text;
    chip.dataset.index = String(index);
    chip.setAttribute('role', 'option');
    chip.setAttribute('tabindex', '0');

    chip.addEventListener('click', () => {
      // Visual feedback — briefly mark as active
      chip.classList.add(CHIP_ACTIVE_CLASS);
      onClick(text, index);
    });

    // Keyboard: Enter/Space triggers click
    chip.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        chip.click();
      }
    });

    container.appendChild(chip);
    return chip;
  });

  // Make the container a listbox for a11y
  container.setAttribute('role', 'listbox');
  container.setAttribute('aria-label', 'Варианты ответа');

  console.log(`[TG-AI] Rendered ${chips.length} suggestion chip(s)`);
  return chips;
}

/** Remove all chips from the container */
export function clearChips(): void {
  const container = document.querySelector(CONTAINER_SELECTOR);
  if (container) {
    container.innerHTML = '';
    console.log('[TG-AI] Chips cleared');
  }
}

/** Return the currently rendered chip texts */
export function getChipTexts(): string[] {
  const container = document.querySelector(CONTAINER_SELECTOR);
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(`.${CHIP_CLASS}`),
  ).map((el) => el.textContent ?? '');
}
