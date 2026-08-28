import type { ChatContext } from '../types';

/** Tone preset label */
export type TonePreset = 'informal' | 'balanced' | 'formal';

/** Maps chat type to a tone preset */
export function getTonePreset(chatType: ChatContext['chatType']): TonePreset {
  switch (chatType) {
    case 'private':
      return 'informal';
    case 'group':
      return 'balanced';
    case 'channel':
      return 'formal';
  }
}

/**
 * Tone instruction snippets injected into the system prompt.
 * Each maps a TonePreset to a concise directive the AI model follows.
 */
const toneInstructions: Record<TonePreset, string> = {
  informal: [
    'Пиши в неформальном, дружеском тоне.',
    'Можно использовать эмодзи, сокращения и разговорные выражения.',
    'Обращайся на «ты». Будь лёгким и естественным.',
  ].join(' '),

  balanced: [
    'Пиши в нейтральном, вежливом тоне.',
    'Учитывай, что сообщение видят несколько участников.',
    'Избегай слишком фамильярных или слишком официальных выражений.',
    'При обращении допустимо и «ты», и «вы» — ориентируйся на контекст беседы.',
  ].join(' '),

  formal: [
    'Пиши в формальном, информативном тоне.',
    'Используй чёткие формулировки без сленга и эмодзи.',
    'Обращайся на «вы». Стиль — как в деловом или информационном канале.',
  ].join(' '),
};

/**
 * Returns a system-prompt snippet that instructs the AI model
 * to use the appropriate tone for the given chat context.
 *
 * @example
 * const snippet = getToneInstruction('private');
 * // → "Тон ответа: informal (личная переписка).\nПиши в неформальном ..."
 */
export function getToneInstruction(chatType: ChatContext['chatType']): string {
  const preset = getTonePreset(chatType);
  const label = toneLabel(chatType, preset);
  return `Тон ответа: ${label}.\n${toneInstructions[preset]}`;
}

/** Human-readable label for logging / debug */
function toneLabel(chatType: ChatContext['chatType'], preset: TonePreset): string {
  const chatLabels: Record<ChatContext['chatType'], string> = {
    private: 'личная переписка',
    group: 'групповой чат',
    channel: 'канал',
  };
  return `${preset} (${chatLabels[chatType]})`;
}
