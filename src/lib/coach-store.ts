import * as FileSystem from 'expo-file-system/legacy';

import { CoachWeek } from './coach-plan';
import { getExercise } from './exercises';
import { generateSession, phaseForWeek, SessionPlan } from './session';

/**
 * The current coach week on disk. Only move *ids* and durations are stored —
 * never serialized Exercise objects — so a library edit (renaming a cue, say)
 * flows through on load instead of leaving a stale copy behind.
 */
const path = () => `${FileSystem.documentDirectory ?? ''}coach-week.json`;

interface StoredMove {
  moveId: string;
  workSeconds: number;
  restSeconds: number;
}

interface StoredSession {
  name: string;
  moves: StoredMove[];
}

interface StoredCoachWeek {
  week: number;
  notes: string;
  generatedAt: string;
  rejectedMoveIds: string[];
  sessions: StoredSession[];
}

function toStored(plan: CoachWeek): StoredCoachWeek {
  return {
    week: plan.week,
    notes: plan.notes,
    generatedAt: plan.generatedAt,
    rejectedMoveIds: plan.rejectedMoveIds,
    sessions: plan.sessions.map((session) => ({
      name: session.name,
      moves: session.moves.map((move) => ({
        moveId: move.exercise.id,
        workSeconds: move.workSeconds,
        restSeconds: move.restSeconds,
      })),
    })),
  };
}

function fromStored(stored: StoredCoachWeek): CoachWeek {
  const phase = phaseForWeek(stored.week);
  const sessions: SessionPlan[] = [];
  for (const session of stored.sessions) {
    const moves = session.moves
      .map((move) => {
        try {
          return {
            exercise: getExercise(move.moveId),
            workSeconds: move.workSeconds,
            restSeconds: move.restSeconds,
          };
        } catch {
          // The library dropped this move since the plan was generated.
          return null;
        }
      })
      .filter((move): move is NonNullable<typeof move> => move !== null);
    if (moves.length === 0) continue;
    sessions.push({
      name: session.name,
      week: stored.week,
      phase,
      moves,
      totalSeconds: moves.reduce(
        (sum, move) => sum + move.workSeconds + move.restSeconds,
        0,
      ),
    });
  }
  return {
    week: stored.week,
    phase,
    notes: stored.notes,
    sessions,
    rejectedMoveIds: stored.rejectedMoveIds ?? [],
    generatedAt: stored.generatedAt,
  };
}

export async function saveCoachWeek(plan: CoachWeek): Promise<void> {
  await FileSystem.writeAsStringAsync(
    path(),
    JSON.stringify(toStored(plan), null, 2),
  );
}

export async function loadCoachWeek(): Promise<CoachWeek | null> {
  try {
    const json = await FileSystem.readAsStringAsync(path());
    const parsed = JSON.parse(json) as StoredCoachWeek;
    if (!parsed || !Array.isArray(parsed.sessions)) return null;
    const week = fromStored(parsed);
    return week.sessions.length > 0 ? week : null;
  } catch {
    // Nothing generated yet, or the file is unreadable.
    return null;
  }
}

export async function clearCoachWeek(): Promise<void> {
  await FileSystem.deleteAsync(path(), { idempotent: true });
}

export interface TodaysPlan {
  plan: SessionPlan;
  /** True when this came from the coach rather than the built-in templates. */
  fromCoach: boolean;
}

/**
 * What the Train and Workout screens should run: the coach's first session if
 * a week has been generated, otherwise the deterministic template.
 */
export async function loadTodaysPlan(): Promise<TodaysPlan> {
  const coachWeek = await loadCoachWeek();
  if (coachWeek && coachWeek.sessions.length > 0) {
    return { plan: coachWeek.sessions[0], fromCoach: true };
  }
  return { plan: generateSession(), fromCoach: false };
}
