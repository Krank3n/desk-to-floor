import * as FileSystem from 'expo-file-system/legacy';

import { BeatGrid } from './music';

/**
 * Music settings persist between sessions: which local track to play, its
 * tempo, and whether move changes snap to the beat. Stored as one small JSON
 * file — no external services, works offline (DECISIONS.md).
 */
export interface MusicSettings {
  /** Path to the imported track in app storage, or null. */
  trackUri: string | null;
  trackName: string | null;
  bpm: number | null;
  musicMode: boolean;
  /** Breaking counts in 8s; configurable but never surfaced in v1. */
  phraseBeats: number;
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  trackUri: null,
  trackName: null,
  bpm: null,
  musicMode: false,
  phraseBeats: 8,
};

const settingsPath = () => `${FileSystem.documentDirectory ?? ''}music.json`;
const musicDir = () => `${FileSystem.documentDirectory ?? ''}music/`;

export async function loadMusicSettings(): Promise<MusicSettings> {
  try {
    const json = await FileSystem.readAsStringAsync(settingsPath());
    return { ...DEFAULT_MUSIC_SETTINGS, ...JSON.parse(json) };
  } catch {
    // No settings yet, or unreadable: fall back to defaults rather than fail.
    return DEFAULT_MUSIC_SETTINGS;
  }
}

export async function saveMusicSettings(
  settings: MusicSettings,
): Promise<void> {
  await FileSystem.writeAsStringAsync(
    settingsPath(),
    JSON.stringify(settings, null, 2),
  );
}

/**
 * Copy a picked track into app storage. The picker hands back a cache uri
 * that the OS may evict; the workout must still find the track next week.
 */
export async function importTrack(
  uri: string,
  name: string,
): Promise<{ trackUri: string; trackName: string }> {
  const dir = musicDir();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined,
  );
  const safeName = name.replace(/[^\w.-]+/g, '_');
  const dest = dir + safeName;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return { trackUri: dest, trackName: name };
}

/** Music mode needs both a track to play and a tempo to count. */
export function musicModeReady(settings: MusicSettings): boolean {
  return settings.musicMode && !!settings.trackUri && !!settings.bpm;
}

/**
 * The beat grid for a session starting now. `startMs` is the session-clock
 * time at which playback began (0 when music starts with the session).
 */
export function gridFor(
  settings: MusicSettings,
  startMs: number,
): BeatGrid | null {
  if (!musicModeReady(settings) || !settings.bpm) return null;
  return {
    bpm: settings.bpm,
    beatGridStartMs: startMs,
    phraseBeats: settings.phraseBeats,
  };
}
