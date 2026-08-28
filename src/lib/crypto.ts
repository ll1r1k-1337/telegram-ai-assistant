// AES-GCM encryption for API keys in chrome.storage
// Uses Web Crypto API available in service workers and extension pages

const STORAGE_CRYPTO_KEY = '_cryptoKey';
const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_BYTES = 12;

/** Get or create the encryption key, stored as JWK in chrome.storage.local */
async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get(STORAGE_CRYPTO_KEY);
  if (stored[STORAGE_CRYPTO_KEY]) {
    return crypto.subtle.importKey(
      'jwk',
      stored[STORAGE_CRYPTO_KEY] as JsonWebKey,
      { name: ALGO, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    );
  }
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.local.set({ [STORAGE_CRYPTO_KEY]: jwk });
  return key;
}

/** Encrypt plaintext → base64 string (IV prepended to ciphertext) */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded,
  );
  // Concatenate IV + ciphertext
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt base64 string (IV + ciphertext) → plaintext */
export async function decrypt(encoded: string): Promise<string> {
  const key = await getOrCreateKey();
  const raw = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, IV_BYTES);
  const ciphertext = raw.slice(IV_BYTES);
  const plainBuf = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plainBuf);
}

/**
 * Migrate plaintext apiKey → encrypted apiKeyEnc.
 * Idempotent: does nothing if apiKey is absent or apiKeyEnc already exists.
 */
export async function migrateApiKey(): Promise<void> {
  const data = await chrome.storage.local.get(['apiKey', 'apiKeyEnc']);
  if (data.apiKey && !data.apiKeyEnc) {
    const enc = await encrypt(data.apiKey);
    await chrome.storage.local.set({ apiKeyEnc: enc });
    await chrome.storage.local.remove('apiKey');
    console.log('[TG-AI] Migrated plaintext apiKey → encrypted apiKeyEnc');
  }
}
