import {
  beatDurationMs,
  BeatGrid,
  bpmFromTaps,
  nearestBeatMs,
  nextPhraseBoundaryMs,
  phraseDurationMs,
  snapToPhrase,
} from '@/lib/music';

// 120 BPM: 500ms beats, 4000ms per 8-count, grid anchored at 1000ms.
const grid: BeatGrid = { bpm: 120, beatGridStartMs: 1000, phraseBeats: 8 };

describe('durations', () => {
  it('computes beat and phrase durations', () => {
    expect(beatDurationMs(120)).toBe(500);
    expect(phraseDurationMs(grid)).toBe(4000);
  });
});

describe('bpmFromTaps', () => {
  it('needs at least 4 taps', () => {
    expect(bpmFromTaps([0, 500, 1000])).toBeNull();
  });

  it('estimates steady taps exactly', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500, 2000])).toBe(120);
  });

  it('survives one missed tap (double interval discarded)', () => {
    // Steady 500ms taps with one 1000ms gap where a tap was missed.
    expect(bpmFromTaps([0, 500, 1000, 2000, 2500, 3000])).toBe(120);
  });

  it('rejects implausible tempos', () => {
    expect(bpmFromTaps([0, 10000, 20000, 30000])).toBeNull(); // 6 BPM
    expect(bpmFromTaps([0, 100, 200, 300])).toBeNull(); // 600 BPM
  });
});

describe('nextPhraseBoundaryMs', () => {
  it('returns the grid start for times at or before it', () => {
    expect(nextPhraseBoundaryMs(grid, 0)).toBe(1000);
    expect(nextPhraseBoundaryMs(grid, 1000)).toBe(1000);
  });

  it('returns the next boundary mid-phrase', () => {
    expect(nextPhraseBoundaryMs(grid, 1001)).toBe(5000);
    expect(nextPhraseBoundaryMs(grid, 4999)).toBe(5000);
  });

  it('returns the boundary itself when exactly on one', () => {
    expect(nextPhraseBoundaryMs(grid, 5000)).toBe(5000);
    expect(nextPhraseBoundaryMs(grid, 9000)).toBe(9000);
  });
});

describe('snapToPhrase', () => {
  it('stretches a planned end to finish the 8-count, never shrinks', () => {
    expect(snapToPhrase(grid, 6200)).toBe(9000);
    expect(snapToPhrase(grid, 9000)).toBe(9000);
  });
});

describe('nearestBeatMs', () => {
  it('quantizes to the closest beat in either direction', () => {
    expect(nearestBeatMs(grid, 1200)).toBe(1000);
    expect(nearestBeatMs(grid, 1300)).toBe(1500);
    expect(nearestBeatMs(grid, 5480)).toBe(5500);
  });
});
