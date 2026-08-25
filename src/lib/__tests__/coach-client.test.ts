import { CoachRequestError, generateCoachWeek } from '@/lib/coach-client';

const VALID_KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';

const goodBody = {
  week: 5,
  notes: 'Wrists held up, so floor work starts.',
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

function okResponse(body: unknown, stopReason = 'end_turn'): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      stop_reason: stopReason,
      content: [{ type: 'text', text: JSON.stringify(body) }],
    }),
    text: async () => '',
  } as unknown as Response;
}

function errorResponse(status: number, body = 'nope'): Response {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({}),
  } as unknown as Response;
}

function run(fetchImpl: typeof fetch, week = 5) {
  return generateCoachWeek({
    apiKey: VALID_KEY,
    week,
    trainingLog: 'No sessions logged yet.',
    fetchImpl,
  });
}

describe('generateCoachWeek', () => {
  it('posts to the Messages API with auth and version headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse(goodBody));
    await run(fetchImpl as unknown as typeof fetch);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe(VALID_KEY);
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('requests Opus 5 with adaptive thinking and a constrained JSON shape', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse(goodBody));
    await run(fetchImpl as unknown as typeof fetch);

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('claude-opus-5');
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config.effort).toBe('high');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.system).toContain('Wrist prep opens every session');
    expect(body.messages[0].content).toContain('Program week: 5');
  });

  it('returns a validated week on success', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse(goodBody));
    const plan = await run(fetchImpl as unknown as typeof fetch);
    expect(plan.week).toBe(5);
    expect(plan.sessions[0].moves.map((m) => m.exercise.id)).toEqual([
      'wrist-rocks',
      'six-step-half-speed',
    ]);
  });

  describe('failure paths', () => {
    it('explains a rejected key rather than leaking the status', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(errorResponse(401));
      await expect(run(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        /API key was rejected/,
      );
    });

    it('names rate limiting', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(errorResponse(429));
      await expect(run(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        /Rate limited/,
      );
    });

    it('treats 5xx as transient', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(errorResponse(503));
      await expect(run(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        /having trouble/,
      );
    });

    it('reports a network failure as such', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
      await expect(run(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        /check your connection/,
      );
    });

    it('surfaces a refusal instead of parsing empty content', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(okResponse(goodBody, 'refusal'));
      await expect(run(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        /declined this request/,
      );
    });

    it('wraps an unusable response as a CoachRequestError', async () => {
      const fetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: 'not json' }] }),
        text: async () => '',
      } as unknown as Response);
      await expect(run(fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(
        CoachRequestError,
      );
    });
  });
});
