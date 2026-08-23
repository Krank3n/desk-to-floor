import { buildEventLog, EventLog, SessionEvent } from '@/lib/eventlog';

import { gridAnchorAt, planEdit } from '../edl';

function makeLog(
  events: SessionEvent[],
  extra: Partial<Pick<EventLog, 'recording' | 'music'>> = {},
): EventLog {
  return buildEventLog({
    sessionId: 'test',
    startedAt: '2026-08-21T09:30:00.000+10:00',
    appVersion: '0.4.0',
    plan: { name: 'Undesk · Week 1', moveIds: [] },
    events,
    recording: { file: 'session-test.mp4', startOffsetMs: 0 },
    ...extra,
  });
}

/** Two moves with a rest between them: 0–40s work, 40–50s rest, 50–110s work. */
const twoMoves: SessionEvent[] = [
  { type: 'session_start', atMs: 0 },
  { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
  { type: 'move_end', atMs: 40000, moveId: 'wrist-rocks' },
  { type: 'rest_start', atMs: 40000, durationMs: 10000 },
  { type: 'rest_end', atMs: 50000 },
  {
    type: 'move_start',
    atMs: 50000,
    moveId: 'six-step-half-speed',
    name: '6-step (half speed)',
  },
  { type: 'move_end', atMs: 110000, moveId: 'six-step-half-speed' },
  { type: 'session_end', atMs: 110000 },
];

describe('planEdit', () => {
  it('refuses a session with no footage', () => {
    expect(() => planEdit(makeLog(twoMoves, { recording: null }))).toThrow(
      'no recording',
    );
  });

  it('keeps work intervals and drops the rest between them', () => {
    const plan = planEdit(makeLog(twoMoves), { handleMs: 0 });
    expect(plan.segments).toEqual([
      {
        moveId: 'wrist-rocks',
        name: 'Wrist rocks',
        startMs: 0,
        endMs: 40000,
        highlight: false,
      },
      {
        moveId: 'six-step-half-speed',
        name: '6-step (half speed)',
        startMs: 50000,
        endMs: 110000,
        highlight: true,
      },
    ]);
    expect(plan.totalMs).toBe(100000);
  });

  it('marks only breaking skills as Shorts material', () => {
    const plan = planEdit(makeLog(twoMoves), { handleMs: 0 });
    expect(plan.segments.filter((s) => s.highlight).map((s) => s.moveId)).toEqual(
      ['six-step-half-speed'],
    );
  });

  it('shifts video times by the recording offset', () => {
    const plan = planEdit(
      makeLog(twoMoves, {
        recording: { file: 'session-test.mp4', startOffsetMs: 5000 },
      }),
      { handleMs: 0 },
    );
    expect(plan.segments[0].startMs).toBe(0); // clamped, not negative
    expect(plan.segments[0].endMs).toBe(35000);
    expect(plan.segments[1].startMs).toBe(45000);
  });

  it('pads cuts with handles without letting neighbours overlap', () => {
    const plan = planEdit(makeLog(twoMoves), { handleMs: 250 });
    expect(plan.segments[0].startMs).toBe(0); // clamped at the source start
    expect(plan.segments[0].endMs).toBe(40250);
    expect(plan.segments[1].startMs).toBe(49750);
    // Handles never make one segment run into the next.
    expect(plan.segments[0].endMs).toBeLessThan(plan.segments[1].startMs);
  });

  describe('redo markers', () => {
    it('discards the take before the marker', () => {
      const events: SessionEvent[] = [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow' },
        { type: 'redo', atMs: 15000, moveId: 'crow-hold' },
        { type: 'move_end', atMs: 40000, moveId: 'crow-hold' },
        { type: 'session_end', atMs: 40000 },
      ];
      const plan = planEdit(makeLog(events), { handleMs: 0 });
      expect(plan.segments).toHaveLength(1);
      expect(plan.segments[0].startMs).toBe(15000);
    });

    it('keeps only the last take when there are several redos', () => {
      const events: SessionEvent[] = [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow' },
        { type: 'redo', atMs: 10000, moveId: 'crow-hold' },
        { type: 'redo', atMs: 25000, moveId: 'crow-hold' },
        { type: 'move_end', atMs: 40000, moveId: 'crow-hold' },
        { type: 'session_end', atMs: 40000 },
      ];
      const plan = planEdit(makeLog(events), { handleMs: 0 });
      expect(plan.segments[0].startMs).toBe(25000);
    });
  });

  describe('pauses', () => {
    it('splits a move around a paused stretch, dropping the dead air', () => {
      const events: SessionEvent[] = [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow' },
        { type: 'pause', atMs: 10000 },
        { type: 'resume', atMs: 70000 },
        { type: 'move_end', atMs: 100000, moveId: 'crow-hold' },
        { type: 'session_end', atMs: 100000 },
      ];
      const plan = planEdit(makeLog(events), { handleMs: 0 });
      expect(plan.segments).toEqual([
        expect.objectContaining({ startMs: 0, endMs: 10000 }),
        expect.objectContaining({ startMs: 70000, endMs: 100000 }),
      ]);
    });
  });

  it('drops fragments too short to be worth a cut', () => {
    const events: SessionEvent[] = [
      { type: 'session_start', atMs: 0 },
      { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow' },
      { type: 'pause', atMs: 400 }, // only 0.4s of usable footage before it
      { type: 'resume', atMs: 5000 },
      { type: 'move_end', atMs: 40000, moveId: 'crow-hold' },
      { type: 'session_end', atMs: 40000 },
    ];
    const plan = planEdit(makeLog(events), { handleMs: 0, minSegmentMs: 1000 });
    expect(plan.segments).toEqual([
      expect.objectContaining({ startMs: 5000, endMs: 40000 }),
    ]);
  });

  it('closes an unterminated move at session_end', () => {
    const events: SessionEvent[] = [
      { type: 'session_start', atMs: 0 },
      { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow' },
      { type: 'session_end', atMs: 30000 },
    ];
    const plan = planEdit(makeLog(events), { handleMs: 0 });
    expect(plan.segments).toEqual([
      expect.objectContaining({ startMs: 0, endMs: 30000 }),
    ]);
  });
});

describe('music mode', () => {
  // 120 BPM = 500ms beats, grid anchored at session 0.
  const music = {
    track: 'break.mp3',
    bpm: 120,
    beatGridStartMs: 0,
    phraseBeats: 8,
  };

  it('rounds cuts inward to the beat', () => {
    const events: SessionEvent[] = [
      { type: 'session_start', atMs: 0 },
      { type: 'move_start', atMs: 1200, moveId: 'crow-hold', name: 'Crow' },
      { type: 'move_end', atMs: 41300, moveId: 'crow-hold' },
      { type: 'session_end', atMs: 41300 },
    ];
    const plan = planEdit(makeLog(events, { music }));
    // Start rounds up to 1500, end rounds down to 41000 — never outward.
    expect(plan.segments[0]).toEqual(
      expect.objectContaining({ startMs: 1500, endMs: 41000 }),
    );
    expect(plan.bpm).toBe(120);
  });

  it('applies the pause shift to the grid, per EVENTLOG.md', () => {
    // Pause off-beat (10100, not a multiple of 500) so the shift is visible:
    // without it the second half would quantize against the original grid.
    const events: SessionEvent[] = [
      { type: 'session_start', atMs: 0 },
      { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow' },
      { type: 'pause', atMs: 10100 },
      { type: 'resume', atMs: 12300 }, // grid slides forward 2200ms
      { type: 'move_end', atMs: 40000, moveId: 'crow-hold' },
      { type: 'session_end', atMs: 40000 },
    ];
    const log = makeLog(events, { music });
    expect(gridAnchorAt(log, 5000)).toBe(0); // before the pause: unshifted
    expect(gridAnchorAt(log, 20000)).toBe(2200); // after it: shifted

    const plan = planEdit(log);
    // Before the pause the grid is 0 + n*500, so the cut lands on 10000.
    expect(plan.segments[0]).toEqual(
      expect.objectContaining({ startMs: 0, endMs: 10000 }),
    );
    // After it the grid is 2200 + n*500: the first beat at or after the
    // resume (12300) is 12700, and the last one before the end is 39700.
    expect(plan.segments[1]).toEqual(
      expect.objectContaining({ startMs: 12700, endMs: 39700 }),
    );
  });

  it('skips handles in music mode — the beat is the edit point', () => {
    const events: SessionEvent[] = [
      { type: 'session_start', atMs: 0 },
      { type: 'move_start', atMs: 1000, moveId: 'crow-hold', name: 'Crow' },
      { type: 'move_end', atMs: 41000, moveId: 'crow-hold' },
      { type: 'session_end', atMs: 41000 },
    ];
    const plan = planEdit(makeLog(events, { music }), { handleMs: 250 });
    expect(plan.segments[0]).toEqual(
      expect.objectContaining({ startMs: 1000, endMs: 41000 }),
    );
  });
});
