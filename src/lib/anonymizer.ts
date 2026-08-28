import type { ChatContext, ChatMessage } from './types';

// ── Constants ────────────────────────────────────────────────────────

/** Labels used as pseudonyms: Собеседник A, Собеседник B, … */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The current-user marker is never anonymized */
const SELF_LABEL = 'Вы';

/** Fallback author when parser finds nothing */
const UNKNOWN_LABEL = 'Unknown';

// ── Types ────────────────────────────────────────────────────────────

/** Bidirectional name mapping */
export interface NameMapping {
  /** real name → pseudonym */
  forward: Map<string, string>;
  /** pseudonym → real name */
  reverse: Map<string, string>;
}

// ── Name map building ────────────────────────────────────────────────

/**
 * Collect every unique real name from a ChatContext and assign a
 * stable pseudonym to each.
 *
 * Skips 'Вы' (self) and 'Unknown' — those carry no identifying info.
 * Pseudonyms look like "Собеседник A", "Собеседник B", etc.
 * The chat name gets its own slot only when it doesn't coincide with
 * an already-mapped author.
 */
export function buildNameMap(context: ChatContext): NameMapping {
  const seen = new Set<string>();

  // Collect author names (insertion-order = message order → deterministic)
  for (const msg of context.messages) {
    addName(seen, msg.author);
    if (msg.forward?.from) addName(seen, msg.forward.from);
  }

  // Chat name (if not already an author)
  addName(seen, context.chatName);

  // Assign pseudonyms
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();
  let idx = 0;

  for (const name of seen) {
    const pseudo = `Собеседник ${ALPHABET[idx % ALPHABET.length]}`;
    forward.set(name, pseudo);
    reverse.set(pseudo, name);
    idx++;
  }

  return { forward, reverse };
}

function addName(set: Set<string>, name: string): void {
  if (name && name !== SELF_LABEL && name !== UNKNOWN_LABEL) {
    set.add(name);
  }
}

// ── Anonymize context ────────────────────────────────────────────────

/**
 * Return a shallow-cloned ChatContext with all real names replaced
 * by their pseudonyms.  The original object is never mutated.
 */
export function anonymizeContext(
  context: ChatContext,
  mapping: NameMapping,
): ChatContext {
  const { forward } = mapping;

  const messages: ChatMessage[] = context.messages.map((msg) => ({
    ...msg,
    author: forward.get(msg.author) ?? msg.author,
    ...(msg.forward?.from
      ? { forward: { from: forward.get(msg.forward.from) ?? msg.forward.from } }
      : {}),
  }));

  return {
    ...context,
    chatName: forward.get(context.chatName) ?? context.chatName,
    messages,
  };
}

// ── De-anonymize AI response ─────────────────────────────────────────

/**
 * Replace pseudonyms back to real names in AI-generated text.
 *
 * Handles the common case where the AI mentions "Собеседник A said…"
 * and we want the user to see the real name.
 */
export function deanonymizeText(
  text: string,
  mapping: NameMapping,
): string {
  let result = text;
  for (const [pseudo, real] of mapping.reverse) {
    result = replaceAll(result, pseudo, real);
  }
  return result;
}

/** Simple whole-string replaceAll (no regex escaping needed — pseudonyms are safe) */
function replaceAll(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  let out = haystack;
  let idx = out.indexOf(needle);
  while (idx !== -1) {
    out = out.slice(0, idx) + replacement + out.slice(idx + needle.length);
    idx = out.indexOf(needle, idx + replacement.length);
  }
  return out;
}
