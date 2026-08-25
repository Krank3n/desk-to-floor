import {
  buildCoachUserMessage,
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM_PROMPT,
  formatExerciseLibrary,
} from '@/lib/coach-prompt';
import { EXERCISES } from '@/lib/exercises';

describe('COACH_SYSTEM_PROMPT', () => {
  it('states the safety rails that matter at 39', () => {
    expect(COACH_SYSTEM_PROMPT).toContain('Wrist prep opens every session');
    expect(COACH_SYSTEM_PROMPT).toContain('No power moves');
    expect(COACH_SYSTEM_PROMPT).toMatch(/deload/i);
  });

  it('forbids inventing move ids', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/only prescribe moves from the exercise library/i);
  });
});

describe('formatExerciseLibrary', () => {
  it('lists every exercise with its id', () => {
    const rendered = formatExerciseLibrary();
    for (const exercise of EXERCISES) {
      expect(rendered).toContain(exercise.id);
    }
    expect(rendered.split('\n')).toHaveLength(EXERCISES.length);
  });
});

describe('buildCoachUserMessage', () => {
  const base = { week: 2, trainingLog: 'No sessions logged yet.' };

  it('names the week, the block, and includes the log', () => {
    const message = buildCoachUserMessage(base);
    expect(message).toContain('Program week: 2 (Undesk block)');
    expect(message).toContain('No sessions logged yet.');
    expect(message).toContain('wrist-rocks');
  });

  it('flags deload weeks', () => {
    expect(buildCoachUserMessage({ ...base, week: 4 })).toContain('DELOAD');
    expect(buildCoachUserMessage({ ...base, week: 8 })).toContain('DELOAD');
    expect(buildCoachUserMessage({ ...base, week: 2 })).not.toContain('DELOAD');
  });

  it('switches the block brief with the program phase', () => {
    expect(buildCoachUserMessage({ ...base, week: 6 })).toContain('Get down block');
    expect(buildCoachUserMessage({ ...base, week: 10 })).toContain('First set block');
  });

  it('is deterministic for the same input', () => {
    expect(buildCoachUserMessage(base)).toBe(buildCoachUserMessage(base));
  });
});

describe('COACH_RESPONSE_SCHEMA', () => {
  it('locks the object shape so the model cannot pad it', () => {
    expect(COACH_RESPONSE_SCHEMA.additionalProperties).toBe(false);
    expect(COACH_RESPONSE_SCHEMA.required).toEqual(['week', 'notes', 'sessions']);
    const move = COACH_RESPONSE_SCHEMA.properties.sessions.items.properties.moves.items;
    expect(move.required).toEqual(['moveId', 'workSeconds', 'restSeconds']);
    expect(move.properties.workSeconds.maximum).toBe(300);
  });
});
