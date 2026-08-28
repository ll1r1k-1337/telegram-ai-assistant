import { describe, it, expect } from 'vitest';
import { isBlacklisted } from '@/lib/blacklist';

describe('isBlacklisted (pure)', () => {
  it('returns false for empty blacklist', () => {
    expect(isBlacklisted('Alice', [])).toBe(false);
  });

  it('returns true for exact match', () => {
    expect(isBlacklisted('Bob', ['Alice', 'Bob', 'Charlie'])).toBe(true);
  });

  it('returns false when chat is not in the list', () => {
    expect(isBlacklisted('Dave', ['Alice', 'Bob'])).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(isBlacklisted('alice', ['Alice'])).toBe(true);
    expect(isBlacklisted('ALICE', ['alice'])).toBe(true);
    expect(isBlacklisted('Alice', ['ALICE'])).toBe(true);
  });

  it('handles unicode chat names', () => {
    expect(isBlacklisted('Мой чат', ['Мой чат', 'Другой'])).toBe(true);
    expect(isBlacklisted('мой чат', ['Мой Чат'])).toBe(true);
  });

  it('handles empty chat name', () => {
    expect(isBlacklisted('', ['Alice'])).toBe(false);
    expect(isBlacklisted('', [''])).toBe(true);
  });

  it('handles whitespace-only chat names correctly', () => {
    expect(isBlacklisted(' ', [' '])).toBe(true);
    expect(isBlacklisted('Alice', [' Alice '])).toBe(false); // no trim — exact match
  });
});
