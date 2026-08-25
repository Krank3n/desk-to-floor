import { CoachResponseError, parseCoachWeek } from '@/lib/coach-plan';

const AT = '2026-08-25T09:00:00.000Z';

function response(body: unknown): string {
  return JSON.stringify(body);
}

const goodWeek = {
  week: 5,
  notes: 'Wrists handled full load, so floor work starts.',
  sessions: [
    {
      name: 'Get down · Day 1',
      moves: [
        { moveId: 'wrist-rocks', workSeconds: 40, restSeconds: 10 },
        { moveId: 'six-step-half-speed', workSeconds: 60, restSeconds: 25 },
      ],
    },
  ],
};

describe('parseCoachWeek', () => {
  it('parses a well-formed week into runnable session plans', () => {
    const plan = parseCoachWeek(response(goodWeek), 1, AT);
    expect(plan.week).toBe(5);
    expect(plan.phase).toBe('Get down');
    expect(plan.notes).toContain('floor work');
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0].moves.map((m) => m.exercise.id)).toEqual([
      'wrist-rocks',
      'six-step-half-speed',
    ]);
    expect(plan.sessions[0].totalSeconds).toBe(135);
    expect(plan.rejectedMoveIds).toEqual([]);
  });

  it('drops moves the library does not have, and reports them', () => {
    const plan = parseCoachWeek(
      response({
        ...goodWeek,
        sessions: [
          {
            name: 'Day 1',
            moves: [
              { moveId: 'wrist-rocks', workSeconds: 40, restSeconds: 10 },
              { moveId: 'windmill', workSeconds: 60, restSeconds: 30 },
              { moveId: 'air-flare', workSeconds: 60, restSeconds: 30 },
            ],
          },
        ],
      }),
      1,
      AT,
    );
    expect(plan.sessions[0].moves.map((m) => m.exercise.id)).toEqual([
      'wrist-rocks',
    ]);
    expect(plan.rejectedMoveIds).toEqual(['windmill', 'air-flare']);
  });

  it('throws when every move was unrecognised', () => {
    expect(() =>
      parseCoachWeek(
        response({
          week: 1,
          notes: '',
          sessions: [{ name: 'Day 1', moves: [{ moveId: 'windmill' }] }],
        }),
        1,
        AT,
      ),
    ).toThrow(CoachResponseError);
  });

  describe('wrist prep rail', () => {
    it('reorders a session that buried wrist prep', () => {
      const plan = parseCoachWeek(
        response({
          ...goodWeek,
          sessions: [
            {
              name: 'Day 1',
              moves: [
                { moveId: 'six-step-half-speed', workSeconds: 60, restSeconds: 20 },
                { moveId: 'wrist-rocks', workSeconds: 40, restSeconds: 10 },
              ],
            },
          ],
        }),
        1,
        AT,
      );
      expect(plan.sessions[0].moves[0].exercise.id).toBe('wrist-rocks');
    });

    it('prepends wrist prep when the coach omitted it entirely', () => {
      const plan = parseCoachWeek(
        response({
          ...goodWeek,
          sessions: [
            {
              name: 'Day 1',
              moves: [
                { moveId: 'crow-hold', workSeconds: 40, restSeconds: 25 },
              ],
            },
          ],
        }),
        1,
        AT,
      );
      expect(plan.sessions[0].moves[0].exercise.category).toBe('wrist-prep');
      expect(plan.sessions[0].moves).toHaveLength(2);
    });
  });

  describe('defensive value handling', () => {
    it('clamps absurd durations into the schema bounds', () => {
      const plan = parseCoachWeek(
        response({
          ...goodWeek,
          sessions: [
            {
              name: 'Day 1',
              moves: [
                { moveId: 'wrist-rocks', workSeconds: 9999, restSeconds: -50 },
              ],
            },
          ],
        }),
        1,
        AT,
      );
      expect(plan.sessions[0].moves[0].workSeconds).toBe(300);
      expect(plan.sessions[0].moves[0].restSeconds).toBe(0);
    });

    it('falls back to library defaults when durations are missing', () => {
      const plan = parseCoachWeek(
        response({
          ...goodWeek,
          sessions: [{ name: 'Day 1', moves: [{ moveId: 'wrist-rocks' }] }],
        }),
        1,
        AT,
      );
      expect(plan.sessions[0].moves[0].workSeconds).toBe(40);
      expect(plan.sessions[0].moves[0].restSeconds).toBe(10);
    });

    it('uses the requested week when the model omits or mangles it', () => {
      const plan = parseCoachWeek(
        response({ ...goodWeek, week: 'five' }),
        9,
        AT,
      );
      expect(plan.week).toBe(9);
      expect(plan.phase).toBe('First set');
    });
  });

  describe('malformed responses', () => {
    it('rejects non-JSON', () => {
      expect(() => parseCoachWeek('sorry, I can not do that', 1, AT)).toThrow(
        'valid JSON',
      );
    });

    it('rejects JSON with no sessions array', () => {
      expect(() => parseCoachWeek(response({ week: 1 }), 1, AT)).toThrow(
        'no sessions',
      );
    });

    it('skips a session whose moves are all junk but keeps the good one', () => {
      const plan = parseCoachWeek(
        response({
          week: 1,
          notes: '',
          sessions: [
            { name: 'Bad', moves: [{ moveId: 'windmill' }] },
            {
              name: 'Good',
              moves: [{ moveId: 'wrist-rocks', workSeconds: 40, restSeconds: 10 }],
            },
          ],
        }),
        1,
        AT,
      );
      expect(plan.sessions).toHaveLength(1);
      expect(plan.sessions[0].name).toBe('Good');
    });
  });
});
