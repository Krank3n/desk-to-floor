/**
 * Music-mode math (M3 groundwork): BPM estimation from tap-tempo, beat grids,
 * and 8-count phrase snapping. Pure functions — the player and the auto-editor
 * both consume these, so the same grid math cuts moves and cuts video.
 */
export interface BeatGrid {
  bpm: number;
  /** Session-clock ms of beat 0 — the "1" of the first 8-count. */
  beatGridStartMs: number;
  /** Beats per phrase; breaking counts in 8s. */
  phraseBeats: number;
}

export function beatDurationMs(bpm: number): number {
  return 60000 / bpm;
}

export function phraseDurationMs(grid: BeatGrid): number {
  return beatDurationMs(grid.bpm) * grid.phraseBeats;
}

/**
 * Estimate BPM from tap-tempo timestamps (ms, ascending). Uses the median
 * interval and discards outliers (missed or double taps) before averaging.
 * Returns null below 4 taps or outside the plausible 40–220 BPM range.
 */
export function bpmFromTaps(tapsMs: number[]): number | null {
  if (tapsMs.length < 4) return null;
  const intervals: number[] = [];
  for (let i = 1; i < tapsMs.length; i++) {
    intervals.push(tapsMs[i] - tapsMs[i - 1]);
  }
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const kept = intervals.filter((v) => v > median * 0.5 && v < median * 2);
  if (kept.length === 0) return null;
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  const bpm = 60000 / mean;
  if (bpm < 40 || bpm > 220) return null;
  return Math.round(bpm * 10) / 10;
}

/** Session-clock ms of the first phrase boundary at or after atMs. */
export function nextPhraseBoundaryMs(grid: BeatGrid, atMs: number): number {
  const phrase = phraseDurationMs(grid);
  const elapsed = atMs - grid.beatGridStartMs;
  if (elapsed <= 0) return grid.beatGridStartMs;
  const phrasesDone = Math.ceil(elapsed / phrase);
  return grid.beatGridStartMs + phrasesDone * phrase;
}

/**
 * Where a move change lands in music mode: the next phrase boundary at or
 * after the planned end. Intervals stretch (never shrink) to finish the 8.
 */
export function snapToPhrase(grid: BeatGrid, plannedEndMs: number): number {
  return nextPhraseBoundaryMs(grid, plannedEndMs);
}

/** Nearest beat to tMs — the auto-editor's cut-point quantizer (M4). */
export function nearestBeatMs(grid: BeatGrid, tMs: number): number {
  const beat = beatDurationMs(grid.bpm);
  const n = Math.round((tMs - grid.beatGridStartMs) / beat);
  return grid.beatGridStartMs + n * beat;
}
