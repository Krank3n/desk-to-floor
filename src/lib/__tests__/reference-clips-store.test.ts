import * as FileSystem from 'expo-file-system/legacy';

import {
  deleteReferenceClip,
  hasReferenceClip,
  listReferenceClipIds,
  referenceClipPath,
  saveReferenceClip,
} from '@/lib/reference-clips-store';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => {
  jest.clearAllMocks();
  fs.makeDirectoryAsync.mockResolvedValue(undefined as never);
  fs.deleteAsync.mockResolvedValue(undefined);
  fs.moveAsync.mockResolvedValue(undefined);
});

describe('referenceClipPath', () => {
  it('builds a path under reference-clips/', () => {
    expect(referenceClipPath('wrist-rocks')).toBe(
      'file:///doc/reference-clips/ref-wrist-rocks.mp4',
    );
  });
});

describe('saveReferenceClip', () => {
  it('clears any existing file then moves the new one into place', async () => {
    await saveReferenceClip('crow-hold', 'file:///cache/tmp.mp4');
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///doc/reference-clips/',
      { intermediates: true },
    );
    expect(fs.deleteAsync).toHaveBeenCalledWith(
      'file:///doc/reference-clips/ref-crow-hold.mp4',
      { idempotent: true },
    );
    expect(fs.moveAsync).toHaveBeenCalledWith({
      from: 'file:///cache/tmp.mp4',
      to: 'file:///doc/reference-clips/ref-crow-hold.mp4',
    });
  });
});

describe('deleteReferenceClip', () => {
  it('deletes idempotently, no error if the clip never existed', async () => {
    await expect(deleteReferenceClip('crow-hold')).resolves.toBeUndefined();
    expect(fs.deleteAsync).toHaveBeenCalledWith(
      'file:///doc/reference-clips/ref-crow-hold.mp4',
      { idempotent: true },
    );
  });
});

describe('hasReferenceClip', () => {
  it('reflects getInfoAsync().exists', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true } as never);
    expect(await hasReferenceClip('crow-hold')).toBe(true);
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
    expect(await hasReferenceClip('crow-hold')).toBe(false);
  });
});

describe('listReferenceClipIds', () => {
  it('extracts move ids from ref-<id>.mp4 filenames, ignoring the rest', async () => {
    fs.readDirectoryAsync.mockResolvedValueOnce([
      'ref-crow-hold.mp4',
      'ref-baby-freeze-prep.mp4',
      '.DS_Store',
    ]);
    const ids = await listReferenceClipIds();
    expect(ids).toEqual(new Set(['crow-hold', 'baby-freeze-prep']));
  });

  it('returns an empty set when the directory does not exist yet', async () => {
    fs.readDirectoryAsync.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(listReferenceClipIds()).resolves.toEqual(new Set());
  });
});
