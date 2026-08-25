import {
  computeMoveProgressions,
  formatProgressionNotes,
} from '@/lib/progression';
import { SessionTrainingLog } from '@/lib/training-log';

function session(
  startedAt: string,
  moves: SessionTrainingLog['moves'],
): SessionTrainingLog {
  return {
    sessionId: `session-${startedAt}`,
    startedAt,
    name: 'Session',
    durationSeconds: 300,
    moves,
    pauseCount: 0,
    plannedMoveCount: moves.length,
    completedMoveCount: moves.filter((m) => m.completed).length,
  };
}

const wristRocks = (overrides: Partial<SessionTrainingLog['moves'][number]> = {}) => ({
  moveId: 'wrist-rocks',
  name: 'Wrist rocks',
  category: 'wrist-prep' as const,
  plannedWorkSeconds: 40,
  actualWorkSeconds: 40,
  redoCount: 0,
  completed: true,
  ...overrides,
});

describe('computeMoveProgressions', () => {
  it('suggests increasing volume after a clean full-time completion', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [wristRocks()]),
    ]);
    expect(progression).toMatchObject({
      moveId: 'wrist-rocks',
      direction: 'increase',
      suggestedWorkSecondsDelta: 5,
      occurrences: 1,
    });
    expect(progression.reason).toMatch(/ready for more/);
  });

  it('holds when the last redo count was exactly one', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [wristRocks({ redoCount: 1 })]),
    ]);
    expect(progression.direction).toBe('hold');
    expect(progression.suggestedWorkSecondsDelta).toBe(0);
  });

  it('holds when the move finished under its planned time despite no redo', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [
        wristRocks({ actualWorkSeconds: 25 }),
      ]),
    ]);
    expect(progression.direction).toBe('hold');
  });

  it('regresses after two or more redos', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [wristRocks({ redoCount: 2 })]),
    ]);
    expect(progression.direction).toBe('regress');
    expect(progression.suggestedWorkSecondsDelta).toBe(-5);
    expect(progression.reason).toMatch(/2 redos/);
  });

  it('regresses when the move was left incomplete', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [
        wristRocks({ completed: false, actualWorkSeconds: 15 }),
      ]),
    ]);
    expect(progression.direction).toBe('regress');
    expect(progression.reason).toMatch(/ended mid-move/);
  });

  it('rounds the suggested delta to the nearest 5 seconds with a 5s floor', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [
        wristRocks({
          moveId: 'six-step-half-speed',
          name: '6-step (half speed)',
          plannedWorkSeconds: 60,
          actualWorkSeconds: 60,
        }),
      ]),
    ]);
    // 60 * 0.15 = 9, rounds to the nearest 5 -> 10
    expect(progression.suggestedWorkSecondsDelta).toBe(10);
  });

  it('goes by the most recent occurrence, regardless of input order', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-25T09:00:00.000Z', [wristRocks({ redoCount: 2 })]),
      session('2026-08-18T09:00:00.000Z', [wristRocks()]),
    ]);
    expect(progression.direction).toBe('regress');
    expect(progression.occurrences).toBe(2);
  });

  it('sorts results by move id', () => {
    const progressions = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [
        wristRocks({ moveId: 'z-move', name: 'Z move' }),
        wristRocks({ moveId: 'a-move', name: 'A move' }),
      ]),
    ]);
    expect(progressions.map((p) => p.moveId)).toEqual(['a-move', 'z-move']);
  });

  it('returns nothing for an empty log', () => {
    expect(computeMoveProgressions([])).toEqual([]);
  });
});

describe('formatProgressionNotes', () => {
  it('falls back when there is no history yet', () => {
    expect(formatProgressionNotes([])).toMatch(/No prior sessions/);
  });

  it('renders one line per move with direction, delta, and reason', () => {
    const [progression] = computeMoveProgressions([
      session('2026-08-20T09:00:00.000Z', [wristRocks()]),
    ]);
    const text = formatProgressionNotes([progression]);
    expect(text).toContain('Computed progression signals');
    expect(text).toContain('Wrist rocks (wrist-rocks): increase (+5s)');
  });
});
