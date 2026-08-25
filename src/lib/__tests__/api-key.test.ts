import * as SecureStore from 'expo-secure-store';

import {
  clearApiKey,
  getApiKey,
  looksLikeApiKey,
  maskApiKey,
  setApiKey,
} from '@/lib/api-key';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const store = SecureStore as jest.Mocked<typeof SecureStore>;
const VALID = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';

beforeEach(() => jest.clearAllMocks());

describe('looksLikeApiKey', () => {
  it('accepts an Anthropic-shaped key', () => {
    expect(looksLikeApiKey(VALID)).toBe(true);
    expect(looksLikeApiKey(`  ${VALID}  `)).toBe(true);
  });

  it('rejects the usual paste mistakes', () => {
    expect(looksLikeApiKey('')).toBe(false);
    expect(looksLikeApiKey('sk-ant-')).toBe(false);
    expect(looksLikeApiKey('hunter2')).toBe(false);
    expect(looksLikeApiKey('sk-proj-abcdefghijklmnopqrstuvwxyz')).toBe(false);
  });
});

describe('maskApiKey', () => {
  it('never shows the middle of the key', () => {
    const masked = maskApiKey(VALID);
    expect(masked).toContain('…');
    expect(masked).not.toContain('mnopqrstuvwxyz');
    expect(masked.startsWith('sk-ant-api')).toBe(true);
  });

  it('fully hides something too short to mask safely', () => {
    expect(maskApiKey('sk-ant')).toBe('••••');
  });
});

describe('storage', () => {
  it('trims on save', async () => {
    await setApiKey(`  ${VALID}  `);
    expect(store.setItemAsync).toHaveBeenCalledWith(
      'anthropic_api_key',
      VALID,
    );
  });

  it('reads a stored key back', async () => {
    store.getItemAsync.mockResolvedValueOnce(VALID);
    await expect(getApiKey()).resolves.toBe(VALID);
  });

  it('treats an unavailable keystore as no key rather than crashing', async () => {
    store.getItemAsync.mockRejectedValueOnce(new Error('keystore locked'));
    await expect(getApiKey()).resolves.toBeNull();
  });

  it('clears', async () => {
    await clearApiKey();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('anthropic_api_key');
  });
});
