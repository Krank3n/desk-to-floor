import { MoveOutcome, SessionTrainingLog } from './training-log';

/**
 * Deterministic volume/progression signals derived from the training log.
 *
 * The coach prompt (coach-prompt.ts) already asks the model to "progress the
 * athlete off the evidence" qualitatively — but that leaves the actual
 * progression call entirely to the model's judgement. This computes an
 * explicit, testable per-move signal from the most recent time each move was
 * run, so the prompt carries a concrete floor rather than a vibe. Pure, no
 * network — same reasoning as training-log.ts.
 */

export type ProgressionDirection = 'increase' | 'hold' | 'regress';

export interface MoveProgression {
  moveId: string;
  name: string;
  direction: ProgressionDirection;
  reason: string;
  /** Suggested work-second delta vs. the current plan; 0 for 'hold'. */
  suggestedWorkSecondsDelta: number;
  /** How many logged sessions have included this move. */
  occurrences: number;
}

function directionFor(outcome: MoveOutcome): { direction: ProgressionDirection; reason: string } {
  if (!outcome.completed) {
    return { direction: 'regress', reason: 'ended mid-move last time — cut volume before repeating' };
  }
  if (outcome.redoCount >= 2) {
    return {
      direction: 'regress',
      reason: `${outcome.redoCount} redos last time — too hard at this volume`,
    };
  }
  if (outcome.redoCount === 1) {
    return { direction: 'hold', reason: 'one redo last time — hold volume before adding more' };
  }
  if (outcome.actualWorkSeconds < outcome.plannedWorkSeconds) {
    return { direction: 'hold', reason: 'completed under the planned time — hold volume' };
  }
  return { direction: 'increase', reason: 'clean completion at full volume — ready for more' };
}

/** ~15% of planned work seconds, rounded to the nearest 5s, floor of 5s. */
function deltaFor(plannedWorkSeconds: number, direction: ProgressionDirection): number {
  if (direction === 'hold') return 0;
  const magnitude = Math.max(5, Math.round((plannedWorkSeconds * 0.15) / 5) * 5);
  return direction === 'increase' ? magnitude : -magnitude;
}

/**
 * One signal per move id that has ever been logged, based on the *most
 * recent* occurrence — matches how the coach system prompt already reasons
 * ("previous session"). Sorted by move id for deterministic output.
 */
export function computeMoveProgressions(sessions: SessionTrainingLog[]): MoveProgression[] {
  const ordered = [...sessions].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  const lastOutcome = new Map<string, MoveOutcome>();
  const occurrences = new Map<string, number>();

  for (const session of ordered) {
    for (const move of session.moves) {
      lastOutcome.set(move.moveId, move);
      occurrences.set(move.moveId, (occurrences.get(move.moveId) ?? 0) + 1);
    }
  }

  return [...lastOutcome.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([moveId, outcome]) => {
      const { direction, reason } = directionFor(outcome);
      return {
        moveId,
        name: outcome.name,
        direction,
        reason,
        suggestedWorkSecondsDelta: deltaFor(outcome.plannedWorkSeconds, direction),
        occurrences: occurrences.get(moveId) ?? 0,
      };
    });
}

/**
 * Renders progression signals as plain text ready to drop into the coach
 * prompt, alongside (not instead of) the full training log.
 */
export function formatProgressionNotes(progressions: MoveProgression[]): string {
  if (progressions.length === 0) {
    return 'No prior sessions to compute progression from — program the base template.';
  }
  const lines = progressions.map((move) => {
    const sign = move.suggestedWorkSecondsDelta > 0 ? '+' : '';
    return `- ${move.name} (${move.moveId}): ${move.direction} (${sign}${move.suggestedWorkSecondsDelta}s) — ${move.reason}`;
  });
  return [
    'Computed progression signals (code-derived from the log, a floor not a ceiling):',
    ...lines,
  ].join('\n');
}
