import { SessionTrainingLog } from './training-log';

/**
 * Progress stats: per-move trend over logged sessions, derived entirely from
 * the training log (itself derived from the event log — no new
 * instrumentation, no schema change). There is no sensor for wrist range of
 * motion or 6-step tempo, so time actually on task per move — already
 * computed by training-log.ts — stands in as the proxy metric for the
 * roadmap's named stats (see DECISIONS.md).
 */

export interface TrackedMove {
  moveId: string;
  label: string;
}

export const TRACKED_MOVES: readonly TrackedMove[] = [
  { moveId: 'wrist-rocks', label: 'Wrist range' },
  { moveId: 'deep-squat-hold', label: 'Squat hold' },
  { moveId: 'crow-hold', label: 'Crow hold' },
  { moveId: 'six-step-half-speed', label: '6-step tempo' },
];

export interface ProgressPoint {
  sessionId: string;
  /** Session's startedAt, ISO 8601. */
  date: string;
  seconds: number;
  redoCount: number;
  completed: boolean;
}

export interface MoveProgress {
  moveId: string;
  label: string;
  /** Oldest first. */
  points: ProgressPoint[];
  bestSeconds: number | null;
  latestSeconds: number | null;
  /** latest - first logged; null with fewer than two points. */
  deltaSeconds: number | null;
}

/** One entry per TRACKED_MOVES, in that order, regardless of what's logged. */
export function computeProgressStats(sessions: SessionTrainingLog[]): MoveProgress[] {
  const ordered = [...sessions].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));

  return TRACKED_MOVES.map(({ moveId, label }) => {
    const points: ProgressPoint[] = [];
    for (const session of ordered) {
      for (const move of session.moves) {
        if (move.moveId !== moveId) continue;
        points.push({
          sessionId: session.sessionId,
          date: session.startedAt,
          seconds: move.actualWorkSeconds,
          redoCount: move.redoCount,
          completed: move.completed,
        });
      }
    }

    const seconds = points.map((p) => p.seconds);
    return {
      moveId,
      label,
      points,
      bestSeconds: seconds.length ? Math.max(...seconds) : null,
      latestSeconds: points.length ? points[points.length - 1].seconds : null,
      deltaSeconds:
        points.length >= 2 ? points[points.length - 1].seconds - points[0].seconds : null,
    };
  });
}
