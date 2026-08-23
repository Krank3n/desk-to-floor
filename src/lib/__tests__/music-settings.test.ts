import * as FileSystem from 'expo-file-system/legacy';

import {
  DEFAULT_MUSIC_SETTINGS,
  gridFor,
  importTrack,
  loadMusicSettings,
  musicModeReady,
  MusicSettings,
  saveMusicSettings,
} from '@/lib/music-settings';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn(),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

const configured: MusicSettings = {
  trackUri: 'file:///doc/music/track.mp3',
  trackName: 'track.mp3',
  bpm: 92,
  musicMode: true,
  phraseBeats: 8,
};

beforeEach(() => jest.clearAllMocks());

describe('loadMusicSettings', () => {
  it('returns defaults when nothing is saved yet', async () => {
    fs.readAsStringAsync.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(loadMusicSettings()).resolves.toEqual(DEFAULT_MUSIC_SETTINGS);
  });

  it('fills missing keys from defaults (forward compatible)', async () => {
    fs.readAsStringAsync.mockResolvedValueOnce('{"bpm":100}');
    const loaded = await loadMusicSettings();
    expect(loaded.bpm).toBe(100);
    expect(loaded.phraseBeats).toBe(8);
    expect(loaded.musicMode).toBe(false);
  });

  it('round-trips through save', async () => {
    await saveMusicSettings(configured);
    const written = (fs.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(written[0]).toBe('file:///doc/music.json');
    fs.readAsStringAsync.mockResolvedValueOnce(written[1]);
    await expect(loadMusicSettings()).resolves.toEqual(configured);
  });
});

describe('importTrack', () => {
  it('copies the picked file into app storage under a safe name', async () => {
    const result = await importTrack('file:///cache/x.mp3', 'My Track (1).mp3');
    expect(fs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/x.mp3',
      to: 'file:///doc/music/My_Track_1_.mp3',
    });
    expect(result.trackUri).toBe('file:///doc/music/My_Track_1_.mp3');
    expect(result.trackName).toBe('My Track (1).mp3');
  });
});

describe('musicModeReady', () => {
  it('needs the toggle, a track, and a tempo', () => {
    expect(musicModeReady(configured)).toBe(true);
    expect(musicModeReady({ ...configured, musicMode: false })).toBe(false);
    expect(musicModeReady({ ...configured, trackUri: null })).toBe(false);
    expect(musicModeReady({ ...configured, bpm: null })).toBe(false);
  });
});

describe('gridFor', () => {
  it('anchors a grid at the playback start time', () => {
    expect(gridFor(configured, 250)).toEqual({
      bpm: 92,
      beatGridStartMs: 250,
      phraseBeats: 8,
    });
  });

  it('is null when music mode is not ready', () => {
    expect(gridFor({ ...configured, bpm: null }, 0)).toBeNull();
  });
});
