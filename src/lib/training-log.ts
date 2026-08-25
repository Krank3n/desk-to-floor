import { EventLog } from './eventlog';
import { ExerciseCategory, getExercise } from './exercises';

/**
 * Turns event logs into the plain-text format the M5 coach prompt will read:
 * what was planned vs. actually done, session over session. Pure — no
 * network, no filesystem — so the (future) Claude API call gets a string
 * built and tested entirely offline.
 */

export interface MoveOutcome {
  moveId: string;
  name: string;
  /** 'unknown' if the move id isn't in the current exercise library. */
  category: ExerciseCategory | 'unknown';
  plannedWorkSeconds: number;
  /** Work time actually on task: post-redo, with paused spans subtracted. */
  actualWorkSeconds: number;
  redoCount: number;
  /** False if the session ended mid-move (no move_end reached). */
  completed: boolean;
}

export interface SessionTrainingLog {
  sessionId: string;
  startedAt: string;
  name: string;
  durationSeconds: number;
  moves: MoveOutcome[];
  pauseCount: number;
  plannedMoveCount: number;
  completedMoveCount: number;
}

function tryGetCategory(moveId: string): ExerciseCategory | 'unknown' {
  try {
    return getExercise(moveId).category;
  } catch {
    return 'unknown';
  }
}

function tryGetPlannedWorkSeconds(moveId: string): number {
  try {
    return getExercise(moveId).workSeconds;
  } catch {
    return 0;
  }
}

interface PauseSpan {
  startMs: number;
  endMs: number;
}

/** Paused spans in session time, same convention as pipeline/src/edl.ts. */
function pausedSpans(log: EventLog): PauseSpan[] {
  const spans: PauseSpan[] = [];
  let openPause: number | null = null;
  for (const event of log.events) {
    if (event.type === 'pause') openPause = event.atMs;
    if (event.type === 'resume' && openPause !== null) {
      spans.push({ startMs: openPause, endMs: event.atMs });
      openPause = null;
    }
  }
  return spans;
}

/** Elapsed time in [startMs, endMs) minus any overlap with paused spans. */
function workedMs(startMs: number, endMs: number, pauses: PauseSpan[]): number {
  let paused = 0;
  for (const pause of pauses) {
    const overlapStart = Math.max(startMs, pause.startMs);
    const overlapEnd = Math.min(endMs, pause.endMs);
    if (overlapEnd > overlapStart) paused += overlapEnd - overlapStart;
  }
  return Math.max(0, endMs - startMs - paused);
}

interface OpenMove {
  moveId: string;
  name: string;
  /** Effective start: the last redo marker, or move_start if none. */
  startMs: number;
  redoCount: number;
}

export function buildSessionTrainingLog(log: EventLog): SessionTrainingLog {
  const pauses = pausedSpans(log);
  const end = [...log.events].reverse().find((e) => e.type === 'session_end');
  const last = log.events[log.events.length - 1];
  const durationMs = end?.atMs ?? last?.atMs ?? 0;

  const moves: MoveOutcome[] = [];
  let open: OpenMove | null = null;

  const finish = (endMs: number, completed: boolean) => {
    if (!open) return;
    moves.push({
      moveId: open.moveId,
      name: open.name,
      category: tryGetCategory(open.moveId),
      plannedWorkSeconds: tryGetPlannedWorkSeconds(open.moveId),
      actualWorkSeconds: Math.round(workedMs(open.startMs, endMs, pauses) / 1000),
      redoCount: open.redoCount,
      completed,
    });
    open = null;
  };

  for (const event of log.events) {
    switch (event.type) {
      case 'move_start':
        open = { moveId: event.moveId, name: event.name, startMs: event.atMs, redoCount: 0 };
        break;
      case 'redo':
        if (open) {
          open.startMs = event.atMs;
          open.redoCount += 1;
        }
        break;
      case 'move_end':
        finish(event.atMs, true);
        break;
    }
  }
  // Session ended (or the log was truncated) mid-move: record it anyway.
  finish(durationMs, false);

  return {
    sessionId: log.sessionId,
    startedAt: log.startedAt,
    name: log.plan.name,
    durationSeconds: Math.round(durationMs / 1000),
    moves,
    pauseCount: pauses.length,
    plannedMoveCount: log.plan.moveIds.length,
    completedMoveCount: moves.filter((m) => m.completed).length,
  };
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function formatMove(move: MoveOutcome): string {
  const redoNote = move.redoCount > 0 ? `, ${move.redoCount} redo${move.redoCount > 1 ? 's' : ''}` : '';
  const statusNote = move.completed ? '' : ' — incomplete';
  return `- ${move.name} (${move.category}): ${move.actualWorkSeconds}s / ${move.plannedWorkSeconds}s planned${redoNote}${statusNote}`;
}

/**
 * Renders sessions oldest-first as plain text, meant to be dropped straight
 * into the coach prompt (M5's weekly-generation step). Deterministic given
 * the same input, so the prompt is exact-string testable.
 */
export function formatTrainingLog(sessions: SessionTrainingLog[]): string {
  if (sessions.length === 0) return 'No sessions logged yet.';

  const ordered = [...sessions].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  const header = `Training log — ${ordered.length} session${ordered.length > 1 ? 's' : ''}`;
  const blocks = ordered.map((session) => {
    const date = session.startedAt.slice(0, 10);
    const completion = `${session.completedMoveCount}/${session.plannedMoveCount} moves completed`;
    const pauseNote = session.pauseCount > 0 ? `, ${session.pauseCount} pause${session.pauseCount > 1 ? 's' : ''}` : '';
    const lines = session.moves.map(formatMove);
    return [
      `## ${date} · ${session.name} — ${formatDuration(session.durationSeconds)}${pauseNote}, ${completion}`,
      ...lines,
    ].join('\n');
  });

  return [header, '', blocks.join('\n\n')].join('\n');
}
