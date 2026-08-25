import { getExercise } from './exercises';
import { PlannedMove, ProgramPhase, phaseForWeek, SessionPlan } from './session';

/**
 * Parsing and validating what the coach sends back.
 *
 * The model is constrained by a JSON schema, but a schema cannot know which
 * move ids exist — so every id is checked against the library here. Pure, and
 * heavily tested: this is the boundary between a language model and a workout
 * the owner will actually do on his wrists.
 */

export interface CoachWeek {
  week: number;
  phase: ProgramPhase;
  notes: string;
  sessions: SessionPlan[];
  /** Moves the coach asked for that the library does not have. */
  rejectedMoveIds: string[];
  /** ISO timestamp of when this plan was generated. */
  generatedAt: string;
}

export class CoachResponseError extends Error {}

interface RawMove {
  moveId?: unknown;
  workSeconds?: unknown;
  restSeconds?: unknown;
}

interface RawSession {
  name?: unknown;
  moves?: unknown;
}

interface RawWeek {
  week?: unknown;
  notes?: unknown;
  sessions?: unknown;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Clamp to the schema's own bounds; a stray value shouldn't reach a timer. */
function clampSeconds(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseMove(raw: RawMove, rejected: string[]): PlannedMove | null {
  if (typeof raw.moveId !== 'string') return null;
  let exercise;
  try {
    exercise = getExercise(raw.moveId);
  } catch {
    // Hallucinated or renamed id: drop the move, keep the session.
    rejected.push(raw.moveId);
    return null;
  }
  return {
    exercise,
    workSeconds: isFiniteNumber(raw.workSeconds)
      ? clampSeconds(raw.workSeconds, 5, 300)
      : exercise.workSeconds,
    restSeconds: isFiniteNumber(raw.restSeconds)
      ? clampSeconds(raw.restSeconds, 0, 300)
      : exercise.restSeconds,
  };
}

/**
 * Wrist prep opens every session — the one rail worth enforcing in code
 * rather than trusting to the prompt (CLAUDE.md safety rails, channel plan).
 */
function ensureWristPrepFirst(moves: PlannedMove[]): PlannedMove[] {
  if (moves.length === 0) return moves;
  if (moves[0].exercise.category === 'wrist-prep') return moves;
  const wristIndex = moves.findIndex(
    (move) => move.exercise.category === 'wrist-prep',
  );
  if (wristIndex > 0) {
    // Wrist prep was programmed, just not first: move it to the front.
    const reordered = [...moves];
    const [wrist] = reordered.splice(wristIndex, 1);
    return [wrist, ...reordered];
  }
  // None at all: prepend the library default rather than run the session cold.
  return [
    {
      exercise: getExercise('wrist-rocks'),
      workSeconds: getExercise('wrist-rocks').workSeconds,
      restSeconds: getExercise('wrist-rocks').restSeconds,
    },
    ...moves,
  ];
}

function parseSession(
  raw: RawSession,
  week: number,
  phase: ProgramPhase,
  rejected: string[],
): SessionPlan | null {
  if (!Array.isArray(raw.moves)) return null;
  const parsed = raw.moves
    .map((move) => parseMove(move as RawMove, rejected))
    .filter((move): move is PlannedMove => move !== null);
  if (parsed.length === 0) return null;

  const moves = ensureWristPrepFirst(parsed);
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : `${phase} · Week ${week}`,
    week,
    phase,
    moves,
    totalSeconds: moves.reduce(
      (sum, move) => sum + move.workSeconds + move.restSeconds,
      0,
    ),
  };
}

/**
 * Turn the model's JSON into usable session plans. Throws only when nothing
 * salvageable came back; partial damage (one bad move, one bad session) is
 * absorbed and reported via `rejectedMoveIds`.
 */
export function parseCoachWeek(
  json: string,
  fallbackWeek: number,
  generatedAt: string = new Date().toISOString(),
): CoachWeek {
  let raw: RawWeek;
  try {
    raw = JSON.parse(json) as RawWeek;
  } catch {
    throw new CoachResponseError('The coach did not return valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sessions)) {
    throw new CoachResponseError('The coach response had no sessions.');
  }

  const week = isFiniteNumber(raw.week) ? Math.max(1, Math.round(raw.week)) : fallbackWeek;
  const phase = phaseForWeek(week);
  const rejectedMoveIds: string[] = [];
  const sessions = raw.sessions
    .map((session) => parseSession(session as RawSession, week, phase, rejectedMoveIds))
    .filter((session): session is SessionPlan => session !== null);

  if (sessions.length === 0) {
    throw new CoachResponseError(
      'The coach returned no usable sessions — every move was unrecognised.',
    );
  }

  return {
    week,
    phase,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    sessions,
    rejectedMoveIds,
    generatedAt,
  };
}
