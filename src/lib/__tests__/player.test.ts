import { buildEventLog, summarizeEventLog } from '@/lib/eventlog';
import {
  begin,
  createPlayer,
  endSession,
  markRedo,
  pause,
  phaseEndSessionMs,
  phaseRemainingSeconds,
  resume,
  skip,
  tick,
} from '@/lib/player';
import { generateSession } from '@/lib/session';

// Week 1 plan: first move is wrist-rocks (40s work / 10s rest).
const plan = generateSession({ week: 1 });

function beginPlayer() {
  return begin(createPlayer(plan)).state;
}

describe('begin', () => {
  it('records session_start and the first move_start at 0ms and speaks the cue', () => {
    const { state, effects } = begin(createPlayer(plan));
    expect(state.phase).toBe('work');
    expect(state.events).toEqual([
      { type: 'session_start', atMs: 0 },
      {
        type: 'move_start',
        atMs: 0,
        moveId: 'wrist-rocks',
        name: 'Wrist rocks',
      },
    ]);
    expect(effects[0].text).toContain('Wrist rocks');
    expect(effects[0].text).toContain('40 seconds');
  });
});

describe('tick', () => {
  it('finishes a work interval into rest, with 3-2-1 countdown cues', () => {
    let state = beginPlayer();
    const allEffects = [];
    // 40s of work in 250ms ticks.
    for (let i = 0; i < 160; i++) {
      const result = tick(state, 250);
      state = result.state;
      allEffects.push(...result.effects);
    }
    const spoken = allEffects.map((e) => e.text);
    expect(spoken).toContain('3');
    expect(spoken).toContain('2');
    expect(spoken).toContain('1');
    expect(state.phase).toBe('rest');
    expect(state.events).toContainEqual({
      type: 'move_end',
      atMs: 40000,
      moveId: 'wrist-rocks',
    });
    expect(state.events).toContainEqual({
      type: 'rest_start',
      atMs: 40000,
      durationMs: 10000,
    });
  });

  it('crosses work→rest→next move boundaries inside one large delta', () => {
    let state = beginPlayer();
    state = tick(state, 50000).state; // 40s work + 10s rest exactly
    expect(state.phase).toBe('work');
    expect(state.moveIndex).toBe(1);
    expect(state.events).toContainEqual({ type: 'rest_end', atMs: 50000 });
    expect(state.events).toContainEqual({
      type: 'move_start',
      atMs: 50000,
      moveId: plan.moves[1].exercise.id,
      name: plan.moves[1].exercise.name,
    });
  });

  it('runs an entire session to done, producing a valid, buildable log', () => {
    let state = beginPlayer();
    state = tick(state, plan.totalSeconds * 1000).state;
    expect(state.phase).toBe('done');
    const log = buildEventLog({
      sessionId: 'test',
      startedAt: '2026-08-21T09:30:00.000+10:00',
      appVersion: '0.2.0',
      plan: { name: plan.name, moveIds: plan.moves.map((m) => m.exercise.id) },
      events: state.events,
    });
    expect(summarizeEventLog(log).moveCount).toBe(plan.moves.length);
    const last = log.events[log.events.length - 1];
    expect(last.type).toBe('session_end');
  });
});

describe('pause/resume', () => {
  it('freezes the phase timer but keeps the session clock rolling', () => {
    let state = beginPlayer();
    state = tick(state, 10000).state;
    state = pause(state).state;
    state = tick(state, 5000).state;
    expect(state.sessionMs).toBe(15000);
    expect(state.phaseMs).toBe(10000);
    expect(phaseRemainingSeconds(state)).toBe(30);
    state = resume(state).state;
    state = tick(state, 1000).state;
    expect(state.phaseMs).toBe(11000);
    expect(state.events).toContainEqual({ type: 'pause', atMs: 10000 });
    expect(state.events).toContainEqual({ type: 'resume', atMs: 15000 });
  });
});

describe('skip', () => {
  it('ends the current work interval at the current session time', () => {
    let state = beginPlayer();
    state = tick(state, 12345).state;
    state = skip(state).state;
    expect(state.phase).toBe('rest');
    expect(state.events).toContainEqual({
      type: 'move_end',
      atMs: 12345,
      moveId: 'wrist-rocks',
    });
  });
});

describe('music mode', () => {
  // 120 BPM = 500ms beats, 4000ms phrases, anchored 1000ms into the session:
  // boundaries fall at 1000, 5000, 9000, … 41000.
  const grid = { bpm: 120, beatGridStartMs: 1000, phraseBeats: 8 };

  it('stretches a work interval to the next phrase boundary', () => {
    let state = begin(createPlayer(plan), grid).state;
    // Nominal end is 40000; the next 8-count lands at 41000.
    state = tick(state, 40000).state;
    expect(state.phase).toBe('work');
    expect(phaseRemainingSeconds(state)).toBe(1);
    state = tick(state, 1000).state;
    expect(state.phase).toBe('rest');
    expect(state.events).toContainEqual({
      type: 'move_end',
      atMs: 41000,
      moveId: 'wrist-rocks',
    });
  });

  it('never cuts an interval short', () => {
    const state = begin(createPlayer(plan), grid).state;
    expect(phaseEndSessionMs(state)).toBeGreaterThanOrEqual(40000);
  });

  it('re-anchors the grid across a pause so cuts stay on the beat', () => {
    let state = begin(createPlayer(plan), grid).state;
    state = tick(state, 10000).state;
    state = pause(state).state;
    state = tick(state, 3000).state; // paused for 3s
    state = resume(state).state;
    expect(state.grid?.beatGridStartMs).toBe(4000);
    // Boundaries now fall at 4000, 8000, … 44000; the 40s of work finishes
    // nominally at 43000 and stretches to 44000.
    expect(phaseEndSessionMs(state)).toBe(44000);
  });

  it('free-running timing is unchanged when there is no grid', () => {
    const state = begin(createPlayer(plan)).state;
    expect(state.grid).toBeNull();
    expect(phaseEndSessionMs(state)).toBe(40000);
  });
});

describe('markRedo', () => {
  it('drops a redo marker for the current move during work', () => {
    let state = beginPlayer();
    state = tick(state, 20000).state;
    const { state: marked, effects } = markRedo(state);
    expect(marked.events).toContainEqual({
      type: 'redo',
      atMs: 20000,
      moveId: 'wrist-rocks',
    });
    expect(marked.phase).toBe('work');
    expect(effects[0].text).toContain('Redo');
  });

  it('is a no-op outside the work phase', () => {
    let state = beginPlayer();
    state = tick(state, 40000).state; // now resting
    expect(state.phase).toBe('rest');
    const { state: after, effects } = markRedo(state);
    expect(after.events).toEqual(state.events);
    expect(effects).toHaveLength(0);
  });
});

describe('endSession', () => {
  it('closes the current move and records session_end', () => {
    let state = beginPlayer();
    state = tick(state, 8000).state;
    state = endSession(state).state;
    expect(state.phase).toBe('done');
    expect(state.events).toContainEqual({
      type: 'move_end',
      atMs: 8000,
      moveId: 'wrist-rocks',
    });
    const last = state.events[state.events.length - 1];
    expect(last).toEqual({ type: 'session_end', atMs: 8000 });
  });
});
