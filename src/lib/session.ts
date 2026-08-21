import { Exercise, getExercise } from './exercises';

/**
 * Session generation. Deterministic: the same config always yields the same
 * plan, so tests are exact and the (M5) AI coach can reason about output.
 */
export interface SessionConfig {
  /** Program week, 1-based. Weeks beyond 12 repeat the final block. */
  week?: number;
}

export interface PlannedMove {
  exercise: Exercise;
  workSeconds: number;
  restSeconds: number;
}

export interface SessionPlan {
  name: string;
  week: number;
  phase: ProgramPhase;
  moves: PlannedMove[];
  totalSeconds: number;
}

export type ProgramPhase = 'Undesk' | 'Get down' | 'First set';

export function phaseForWeek(week: number): ProgramPhase {
  if (week <= 4) return 'Undesk';
  if (week <= 8) return 'Get down';
  return 'First set';
}

/**
 * Templates are ordered id lists: wrists always open the session, then
 * mobility, then strength, then the skill work. Ids may repeat for extra
 * rounds.
 */
const TEMPLATES: Record<ProgramPhase, string[]> = {
  Undesk: [
    'wrist-rocks',
    'wrist-extension-lifts',
    'ninety-ninety-switches',
    't-spine-rotations',
    'deep-squat-hold',
    'push-ups',
    'incline-rows',
    'hollow-body-hold',
    'toprock-indian-step',
    'toprock-indian-step',
  ],
  'Get down': [
    'wrist-rocks',
    'wrist-extension-lifts',
    'wrist-side-loads',
    'cossack-squats',
    'deep-squat-hold',
    'crow-hold',
    'six-step-half-speed',
    'knee-drop',
    'toprock-indian-step',
  ],
  'First set': [
    'wrist-rocks',
    'wrist-extension-lifts',
    'wrist-side-loads',
    'ninety-ninety-switches',
    'six-step-half-speed',
    'crow-hold',
    'baby-freeze-prep',
    'toprock-indian-step',
    'knee-drop',
    'six-step-half-speed',
  ],
};

export function generateSession(config: SessionConfig = {}): SessionPlan {
  const week = Math.max(1, Math.floor(config.week ?? 1));
  const phase = phaseForWeek(week);
  const moves: PlannedMove[] = TEMPLATES[phase].map((id) => {
    const exercise = getExercise(id);
    return {
      exercise,
      workSeconds: exercise.workSeconds,
      restSeconds: exercise.restSeconds,
    };
  });
  const totalSeconds = moves.reduce(
    (sum, m) => sum + m.workSeconds + m.restSeconds,
    0,
  );
  return {
    name: `${phase} · Week ${week}`,
    week,
    phase,
    moves,
    totalSeconds,
  };
}
