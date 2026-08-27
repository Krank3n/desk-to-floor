import { computeProgressStats, TRACKED_MOVES } from '@/lib/progress-stats';
import { SessionTrainingLog } from '@/lib/training-log';

function session(
  sessionId: string,
  startedAt: string,
  moves: SessionTrainingLog['moves'],
): SessionTrainingLog {
  return {
    sessionId,
    startedAt,
    name: 'Undesk',
    durationSeconds: 300,
    moves,
    pauseCount: 0,
    plannedMoveCount: moves.length,
    completedMoveCount: moves.filter((m) => m.completed).length,
  };
}

function move(
  moveId: string,
  actualWorkSeconds: number,
  overrides: Partial<SessionTrainingLog['moves'][number]> = {},
): SessionTrainingLog['moves'][number] {
  return {
    moveId,
    name: moveId,
    category: 'unknown',
    plannedWorkSeconds: actualWorkSeconds,
    actualWorkSeconds,
    redoCount: 0,
    completed: true,
    ...overrides,
  };
}

describe('computeProgressStats', () => {
  it('returns one entry per tracked move, empty, when no sessions are logged', () => {
    const stats = computeProgressStats([]);
    expect(stats).toHaveLength(TRACKED_MOVES.length);
    for (const stat of stats) {
      expect(stat.points).toEqual([]);
      expect(stat.bestSeconds).toBeNull();
      expect(stat.latestSeconds).toBeNull();
      expect(stat.deltaSeconds).toBeNull();
    }
  });

  it('ignores moves that are not tracked', () => {
    const sessions = [session('s1', '2026-08-20T09:00:00.000Z', [move('push-ups', 40)])];
    const stats = computeProgressStats(sessions);
    for (const stat of stats) {
      expect(stat.points).toEqual([]);
    }
  });

  it('builds a single-point history for one logged occurrence', () => {
    const sessions = [session('s1', '2026-08-20T09:00:00.000Z', [move('crow-hold', 25)])];
    const stats = computeProgressStats(sessions);
    const crow = stats.find((s) => s.moveId === 'crow-hold')!;
    expect(crow.points).toHaveLength(1);
    expect(crow.bestSeconds).toBe(25);
    expect(crow.latestSeconds).toBe(25);
    expect(crow.deltaSeconds).toBeNull();
  });

  it('orders points oldest-first regardless of input order and computes delta/best', () => {
    const sessions = [
      session('s2', '2026-08-22T09:00:00.000Z', [move('crow-hold', 40)]),
      session('s1', '2026-08-20T09:00:00.000Z', [move('crow-hold', 25)]),
      session('s3', '2026-08-24T09:00:00.000Z', [move('crow-hold', 30)]),
    ];
    const stats = computeProgressStats(sessions);
    const crow = stats.find((s) => s.moveId === 'crow-hold')!;
    expect(crow.points.map((p) => p.sessionId)).toEqual(['s1', 's2', 's3']);
    expect(crow.bestSeconds).toBe(40);
    expect(crow.latestSeconds).toBe(30);
    expect(crow.deltaSeconds).toBe(5); // 30 - 25
  });

  it('carries redoCount and completed through to each point', () => {
    const sessions = [
      session('s1', '2026-08-20T09:00:00.000Z', [
        move('deep-squat-hold', 20, { redoCount: 2, completed: false }),
      ]),
    ];
    const stats = computeProgressStats(sessions);
    const squat = stats.find((s) => s.moveId === 'deep-squat-hold')!;
    expect(squat.points[0]).toEqual({
      sessionId: 's1',
      date: '2026-08-20T09:00:00.000Z',
      seconds: 20,
      redoCount: 2,
      completed: false,
    });
  });

  it('tracks wrist-rocks, deep-squat-hold, crow-hold and six-step-half-speed', () => {
    const ids = TRACKED_MOVES.map((m) => m.moveId);
    expect(ids).toEqual([
      'wrist-rocks',
      'deep-squat-hold',
      'crow-hold',
      'six-step-half-speed',
    ]);
  });
});
