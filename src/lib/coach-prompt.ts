import { EXERCISES } from './exercises';
import { phaseForWeek, ProgramPhase } from './session';

/**
 * Builds the coach request: system prompt, user message, and the JSON schema
 * the response is constrained to. Pure — no network — so the exact prompt is
 * unit-testable and reviewable without spending a token.
 */

/** What the 12-week program asks of each block (channel plan, part I). */
const PHASE_BRIEF: Record<ProgramPhase, string> = {
  Undesk:
    'Weeks 1-4. Undo the desk: daily wrist loading, 90/90 hips, T-spine ' +
    'rotation, deep-squat accumulation. Strength is push-ups, rows, squat ' +
    'holds, hollow body. Skill work is toprock only — no floor work yet.',
  'Get down':
    'Weeks 5-8. 6-step at half speed, safe floor entries (knee drop), crow ' +
    'progression, cossack squats. Wrists now take full weight-bearing load.',
  'First set':
    'Weeks 9-12. 6-step at tempo, baby-freeze progression (knee-on-elbow ' +
    'first), and chaining toprock → drop → 6-step → baby freeze.',
};

export const COACH_SYSTEM_PROMPT = [
  'You are the training coach for a 39-year-old software engineer learning to',
  'breakdance from a desk-bound baseline. He trains alone, films every session,',
  'and follows a 12-week program.',
  '',
  'Non-negotiable safety rails:',
  '- Wrist prep opens every session. Never omit it.',
  '- No power moves (windmills, flares, air moves) — those are year two.',
  '- Never program freezes when the log shows the previous session was cut',
  '  short or heavily redone; fatigue is when wrists and shoulders get hurt.',
  '- Weeks 4, 8 and 12 are deload weeks: cut total work time roughly 40%.',
  '- Floor-heavy sessions need 48 hours between them.',
  '',
  'You may ONLY prescribe moves from the exercise library given below, by id.',
  'Inventing an id, or renaming one, breaks the app. If you want work the',
  'library does not cover, say so in the notes instead of inventing it.',
  '',
  'Progress the athlete off the evidence in the training log: actual work',
  'seconds versus planned, redo counts, and whether sessions were completed.',
  'Repeated redos on a move mean it is too hard — regress it or cut volume.',
  'Consistently completing everything means he is ready for more.',
].join('\n');

/** The library, rendered for the prompt. Deterministic ordering. */
export function formatExerciseLibrary(): string {
  return EXERCISES.map(
    (exercise) =>
      `- ${exercise.id} | ${exercise.name} | ${exercise.category} | ` +
      `default ${exercise.workSeconds}s work / ${exercise.restSeconds}s rest`,
  ).join('\n');
}

export interface CoachRequestInput {
  /** Program week the plan is for, 1-based. */
  week: number;
  /** Output of formatTrainingLog(), or a "no sessions" line. */
  trainingLog: string;
  /** Sessions to program for the week. */
  sessionsPerWeek?: number;
}

export function buildCoachUserMessage(input: CoachRequestInput): string {
  const { week, trainingLog, sessionsPerWeek = 3 } = input;
  const phase = phaseForWeek(week);
  return [
    `Program week: ${week} (${phase} block)`,
    `Block brief: ${PHASE_BRIEF[phase]}`,
    week % 4 === 0 ? 'This is a DELOAD week — reduce volume accordingly.' : '',
    '',
    'Exercise library (use these ids exactly):',
    formatExerciseLibrary(),
    '',
    'Training log so far:',
    trainingLog,
    '',
    `Program ${sessionsPerWeek} sessions for this week. For each session give`,
    'an ordered list of moves with work and rest seconds. Open every session',
    'with wrist prep. In `notes`, explain in two or three sentences what you',
    'changed from last week and why — this gets read on camera, so be direct',
    'and specific about the evidence you used.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Response schema. `additionalProperties: false` plus explicit `required`
 * keeps the model from padding the object with fields the app would ignore.
 */
export const COACH_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['week', 'notes', 'sessions'],
  properties: {
    week: { type: 'number', description: 'Program week this plan covers' },
    notes: {
      type: 'string',
      description: 'What changed from last week and why, 2-3 sentences',
    },
    sessions: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'moves'],
        properties: {
          name: { type: 'string', description: 'Short session name' },
          moves: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['moveId', 'workSeconds', 'restSeconds'],
              properties: {
                moveId: {
                  type: 'string',
                  description: 'An id from the exercise library, exactly',
                },
                workSeconds: { type: 'number', minimum: 5, maximum: 300 },
                restSeconds: { type: 'number', minimum: 0, maximum: 300 },
              },
            },
          },
        },
      },
    },
  },
} as const;
