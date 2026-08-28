/**
 * Heuristic language detection — no external deps.
 * Determines conversation language from message texts using Unicode script
 * analysis and common word matching. Returns ISO 639-1 code or 'unknown'.
 */

/** Unicode ranges for script-based detection */
const SCRIPT_RANGES: Array<{ lang: string; test: RegExp }> = [
  { lang: 'zh', test: /[\u4e00-\u9fff\u3400-\u4dbf]/ },
  { lang: 'ja', test: /[\u3040-\u309f\u30a0-\u30ff]/ },
  { lang: 'ko', test: /[\uac00-\ud7af\u1100-\u11ff]/ },
  { lang: 'ar', test: /[\u0600-\u06ff\u0750-\u077f]/ },
  { lang: 'he', test: /[\u0590-\u05ff]/ },
  { lang: 'th', test: /[\u0e00-\u0e7f]/ },
  { lang: 'hi', test: /[\u0900-\u097f]/ },
];

/** Common words for Latin/Cyrillic script languages */
const WORD_LISTS: Record<string, string[]> = {
  ru: [
    'и', 'в', 'на', 'не', 'что', 'это', 'как', 'но', 'да', 'нет',
    'он', 'она', 'мы', 'они', 'все', 'так', 'уже', 'ещё', 'тут', 'там',
    'бы', 'же', 'ли', 'от', 'за', 'по', 'из', 'до', 'ты', 'вы',
    'очень', 'тоже', 'можно', 'надо', 'только', 'потом', 'когда',
    'если', 'чтобы', 'потому', 'привет', 'пока', 'спасибо',
  ],
  uk: [
    'і', 'в', 'на', 'не', 'що', 'це', 'як', 'але', 'так', 'ні',
    'він', 'вона', 'ми', 'вони', 'усе', 'вже', 'ще', 'тут', 'там',
    'би', 'ж', 'чи', 'від', 'за', 'по', 'із', 'до', 'ти', 'ви',
    'дуже', 'також', 'можна', 'треба', 'тільки', 'потім', 'коли',
    'якщо', 'щоб', 'бо', 'привіт', 'дякую',
  ],
  en: [
    'the', 'is', 'are', 'was', 'not', 'and', 'but', 'for', 'you',
    'this', 'that', 'with', 'have', 'from', 'they', 'been', 'will',
    'can', 'just', 'about', 'would', 'there', 'their', 'what', 'when',
    'your', 'how', 'some', 'also', 'very', 'much', 'yes', 'no',
    'hello', 'thanks', 'please', 'sorry',
  ],
  es: [
    'el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'no', 'y',
    'de', 'en', 'que', 'por', 'con', 'para', 'como', 'pero', 'más',
    'muy', 'también', 'este', 'esta', 'esto', 'hola', 'gracias',
  ],
  fr: [
    'le', 'la', 'les', 'un', 'une', 'est', 'sont', 'ne', 'pas', 'et',
    'de', 'en', 'que', 'pour', 'avec', 'comme', 'mais', 'plus',
    'très', 'aussi', 'ce', 'cette', 'bonjour', 'merci',
  ],
  de: [
    'der', 'die', 'das', 'ein', 'eine', 'ist', 'sind', 'nicht', 'und',
    'von', 'in', 'dass', 'für', 'mit', 'wie', 'aber', 'mehr',
    'sehr', 'auch', 'ich', 'du', 'wir', 'hallo', 'danke', 'bitte',
  ],
  pt: [
    'o', 'a', 'os', 'as', 'um', 'uma', 'é', 'são', 'não', 'e',
    'de', 'em', 'que', 'por', 'com', 'para', 'como', 'mas', 'mais',
    'muito', 'também', 'este', 'esta', 'olá', 'obrigado',
  ],
  it: [
    'il', 'lo', 'la', 'i', 'le', 'un', 'una', 'è', 'sono', 'non',
    'e', 'di', 'in', 'che', 'per', 'con', 'come', 'ma', 'più',
    'molto', 'anche', 'questo', 'questa', 'ciao', 'grazie',
  ],
  tr: [
    'bir', 'bu', 've', 'de', 'da', 'mi', 'ile', 'için', 'var',
    'yok', 'ben', 'sen', 'biz', 'çok', 'ama', 'gibi', 'nasıl',
    'evet', 'hayır', 'merhaba', 'teşekkür',
  ],
  pl: [
    'i', 'w', 'na', 'nie', 'co', 'to', 'jak', 'ale', 'tak', 'jest',
    'się', 'że', 'do', 'od', 'za', 'po', 'z', 'ty', 'ja', 'my',
    'bardzo', 'też', 'można', 'trzeba', 'tylko', 'kiedy',
    'cześć', 'dzięki', 'proszę',
  ],
};

/** Detect language from a single text chunk by Unicode script */
function detectScript(text: string): string | null {
  for (const { lang, test } of SCRIPT_RANGES) {
    const cleaned = text.replace(/\s+/g, '');
    let hits = 0;
    for (const ch of cleaned) {
      if (test.test(ch)) hits++;
    }
    if (cleaned.length > 0 && hits / cleaned.length > 0.3) {
      return lang;
    }
  }
  return null;
}

/** Score text against word lists. Returns {lang: score} */
function scoreWordLists(text: string): Record<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return {};

  const scores: Record<string, number> = {};
  for (const [lang, list] of Object.entries(WORD_LISTS)) {
    const set = new Set(list);
    let hits = 0;
    for (const w of words) {
      if (set.has(w)) hits++;
    }
    scores[lang] = hits / words.length;
  }
  return scores;
}

/**
 * Detect language from an array of message texts.
 * Concatenates all texts and uses script + word-frequency heuristics.
 * @returns ISO 639-1 code ('ru', 'en', etc.) or 'unknown'
 */
export function detectLanguage(texts: string[]): string {
  const joined = texts.join(' ').trim();
  if (!joined) return 'unknown';

  // 1. Try script-based detection (CJK, Arabic, etc.)
  const script = detectScript(joined);
  if (script) return script;

  // 2. Cyrillic vs Latin — use word lists
  const scores = scoreWordLists(joined);
  let best = 'unknown';
  let bestScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }

  // Require at least 5% word hit rate to avoid false positives
  return bestScore >= 0.05 ? best : 'unknown';
}
