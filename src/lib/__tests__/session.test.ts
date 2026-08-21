import { generateSession, phaseForWeek } from '@/lib/session';

describe('phaseForWeek', () => {
  it('maps the 12-week program blocks', () => {
    expect(phaseForWeek(1)).toBe('Undesk');
    expect(phaseForWeek(4)).toBe('Undesk');
    expect(phaseForWeek(5)).toBe('Get down');
    expect(phaseForWeek(8)).toBe('Get down');
    expect(phaseForWeek(9)).toBe('First set');
    expect(phaseForWeek(12)).toBe('First set');
    expect(phaseForWeek(40)).toBe('First set');
  });
});

describe('generateSession', () => {
  it('is deterministic for the same config', () => {
    expect(generateSession({ week: 3 })).toEqual(generateSession({ week: 3 }));
  });

  it('defaults to week 1 (Undesk)', () => {
    const plan = generateSession();
    expect(plan.name).toBe('Undesk · Week 1');
    expect(plan.week).toBe(1);
    expect(plan.moves.length).toBeGreaterThanOrEqual(8);
  });

  it('always opens with wrist prep — the non-negotiable', () => {
    for (const week of [1, 5, 9]) {
      const plan = generateSession({ week });
      expect(plan.moves[0].exercise.category).toBe('wrist-prep');
    }
  });

  it('totalSeconds is the sum of work and rest', () => {
    const plan = generateSession({ week: 1 });
    const sum = plan.moves.reduce(
      (acc, m) => acc + m.workSeconds + m.restSeconds,
      0,
    );
    expect(plan.totalSeconds).toBe(sum);
  });

  it('every phase template resolves against the library', () => {
    for (const week of [1, 5, 9]) {
      expect(() => generateSession({ week })).not.toThrow();
    }
  });
});
