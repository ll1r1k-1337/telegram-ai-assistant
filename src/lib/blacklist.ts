/**
 * Chat blacklist — excludes specific chats from AI suggestions.
 * A blacklisted chat never receives suggestions, regardless of whitelist mode.
 */

const STORAGE_KEY = 'chatBlacklist';

/** Read the current blacklist from chrome.storage.local. */
export async function getBlacklist(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] ?? []);
    });
  });
}

/** Save the full blacklist to chrome.storage.local. */
export async function setBlacklist(list: string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: list }, resolve);
  });
}

/** Check if a chat name is blacklisted. */
export async function isChatBlacklisted(chatName: string): Promise<boolean> {
  const list = await getBlacklist();
  return isBlacklisted(chatName, list);
}

/** Pure check: is chatName in the given blacklist? Case-insensitive. */
export function isBlacklisted(chatName: string, blacklist: string[]): boolean {
  const needle = chatName.toLowerCase();
  return blacklist.some((entry) => entry.toLowerCase() === needle);
}

/** Add a chat to the blacklist (no-op if already present). */
export async function addToBlacklist(chatName: string): Promise<string[]> {
  const list = await getBlacklist();
  if (isBlacklisted(chatName, list)) return list;
  const updated = [...list, chatName];
  await setBlacklist(updated);
  return updated;
}

/** Remove a chat from the blacklist (no-op if not present). */
export async function removeFromBlacklist(chatName: string): Promise<string[]> {
  const list = await getBlacklist();
  const needle = chatName.toLowerCase();
  const updated = list.filter((entry) => entry.toLowerCase() !== needle);
  await setBlacklist(updated);
  return updated;
}

/** Toggle a chat in the blacklist. Returns the updated list. */
export async function toggleBlacklist(
  chatName: string,
  blocked: boolean,
): Promise<string[]> {
  return blocked ? addToBlacklist(chatName) : removeFromBlacklist(chatName);
}
