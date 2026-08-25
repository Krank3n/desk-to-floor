import * as SecureStore from 'expo-secure-store';

/**
 * The owner's own Anthropic API key, entered on device and held in the
 * platform keystore. Never committed, never in CI, never in the event log
 * (CLAUDE.md rule 5).
 */
const KEY = 'anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    // Keystore unavailable (locked device, unsupported platform): treat as unset.
    return null;
  }
}

export async function setApiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, value.trim());
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

/**
 * Anthropic keys start `sk-ant-`. Checked so a paste error surfaces on the
 * settings screen instead of as a 401 halfway through a workout.
 */
export function looksLikeApiKey(value: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

/** Never render a key in full — this is what the settings screen shows. */
export function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return '••••';
  return `${trimmed.slice(0, 10)}…${trimmed.slice(-4)}`;
}
