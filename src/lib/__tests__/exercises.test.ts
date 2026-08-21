import { EXERCISES, getExercise } from '@/lib/exercises';

describe('exercise library', () => {
  it('has unique ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every exercise has positive work and a spoken cue', () => {
    for (const e of EXERCISES) {
      expect(e.workSeconds).toBeGreaterThan(0);
      expect(e.restSeconds).toBeGreaterThanOrEqual(0);
      expect(e.cue.length).toBeGreaterThan(10);
    }
  });

  it('getExercise throws on unknown ids', () => {
    expect(() => getExercise('windmill')).toThrow('Unknown exercise id');
  });
});
