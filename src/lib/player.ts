import { SessionEvent } from './eventlog';
import { SessionPlan } from './session';

/**
 * The workout player as a pure state machine. The screen owns a timer and
 * calls tick() with elapsed wall-clock ms; every transition returns speak
 * effects for TTS and appends to the event list that becomes the event log.
 *
 * Clock semantics (EVENTLOG.md): sessionMs always advances — pausing freezes
 * the *phase* timer, not the session clock, so event times stay aligned with
 * continuously-rolling video in M2.
 */
export type PlayerPhase = 'idle' | 'work' | 'rest' | 'done';

export interface SpeakEffect {
  kind: 'speak';
  text: string;
}

export interface PlayerState {
  plan: SessionPlan;
  phase: PlayerPhase;
  paused: boolean;
  /** Index of the current move (valid in work/rest phases). */
  moveIndex: number;
  /** Ms elapsed since begin(), monotonic, never stops until done. */
  sessionMs: number;
  /** Ms elapsed inside the current work/rest phase (frozen while paused). */
  phaseMs: number;
  events: SessionEvent[];
}

export interface TickResult {
  state: PlayerState;
  effects: SpeakEffect[];
}

export function createPlayer(plan: SessionPlan): PlayerState {
  return {
    plan,
    phase: 'idle',
    paused: false,
    moveIndex: 0,
    sessionMs: 0,
    phaseMs: 0,
    events: [],
  };
}

function currentMove(state: PlayerState) {
  return state.plan.moves[state.moveIndex];
}

/** Whole seconds remaining in the current phase (ceil, min 0). */
export function phaseRemainingSeconds(state: PlayerState): number {
  const move = currentMove(state);
  if (!move || (state.phase !== 'work' && state.phase !== 'rest')) return 0;
  const totalMs =
    (state.phase === 'work' ? move.workSeconds : move.restSeconds) * 1000;
  return Math.max(0, Math.ceil((totalMs - state.phaseMs) / 1000));
}

export function begin(state: PlayerState): TickResult {
  if (state.phase !== 'idle') return { state, effects: [] };
  const move = currentMove(state);
  const events: SessionEvent[] = [
    { type: 'session_start', atMs: 0 },
    { type: 'move_start', atMs: 0, moveId: move.exercise.id, name: move.exercise.name },
  ];
  return {
    state: { ...state, phase: 'work', phaseMs: 0, events: [...state.events, ...events] },
    effects: [{ kind: 'speak', text: `${move.exercise.cue} ${move.workSeconds} seconds.` }],
  };
}

export function pause(state: PlayerState): TickResult {
  if (state.paused || state.phase === 'idle' || state.phase === 'done') {
    return { state, effects: [] };
  }
  return {
    state: {
      ...state,
      paused: true,
      events: [...state.events, { type: 'pause', atMs: state.sessionMs }],
    },
    effects: [{ kind: 'speak', text: 'Paused.' }],
  };
}

export function resume(state: PlayerState): TickResult {
  if (!state.paused) return { state, effects: [] };
  return {
    state: {
      ...state,
      paused: false,
      events: [...state.events, { type: 'resume', atMs: state.sessionMs }],
    },
    effects: [{ kind: 'speak', text: 'Go.' }],
  };
}

/** End the current work interval (or rest) early. */
export function skip(state: PlayerState): TickResult {
  if (state.phase !== 'work' && state.phase !== 'rest') {
    return { state, effects: [] };
  }
  return state.phase === 'work'
    ? finishWork(state)
    : finishRest({ ...state });
}

/**
 * Drop a redo marker on the current move (M2): the editor discards footage
 * from the move's start to this marker and keeps the retake.
 */
export function markRedo(state: PlayerState): TickResult {
  if (state.phase !== 'work') return { state, effects: [] };
  return {
    state: {
      ...state,
      events: [
        ...state.events,
        {
          type: 'redo',
          atMs: state.sessionMs,
          moveId: currentMove(state).exercise.id,
        },
      ],
    },
    effects: [{ kind: 'speak', text: 'Redo marked.' }],
  };
}

/** Stop the whole session now, recording session_end. */
export function endSession(state: PlayerState): TickResult {
  if (state.phase === 'done' || state.phase === 'idle') {
    return {
      state: { ...state, phase: 'done' },
      effects: [],
    };
  }
  const events: SessionEvent[] = [...state.events];
  if (state.phase === 'work') {
    events.push({
      type: 'move_end',
      atMs: state.sessionMs,
      moveId: currentMove(state).exercise.id,
    });
  }
  events.push({ type: 'session_end', atMs: state.sessionMs });
  return {
    state: { ...state, phase: 'done', paused: false, events },
    effects: [{ kind: 'speak', text: 'Session ended.' }],
  };
}

function finishWork(state: PlayerState): TickResult {
  const move = currentMove(state);
  const events: SessionEvent[] = [
    ...state.events,
    { type: 'move_end', atMs: state.sessionMs, moveId: move.exercise.id },
  ];
  const isLast = state.moveIndex >= state.plan.moves.length - 1;
  if (isLast) {
    events.push({ type: 'session_end', atMs: state.sessionMs });
    return {
      state: { ...state, phase: 'done', paused: false, phaseMs: 0, events },
      effects: [{ kind: 'speak', text: 'Session complete. Log saved.' }],
    };
  }
  if (move.restSeconds > 0) {
    events.push({
      type: 'rest_start',
      atMs: state.sessionMs,
      durationMs: move.restSeconds * 1000,
    });
    return {
      state: { ...state, phase: 'rest', phaseMs: 0, events },
      effects: [{ kind: 'speak', text: `Rest. ${move.restSeconds} seconds.` }],
    };
  }
  return startNextMove({ ...state, events });
}

function finishRest(state: PlayerState): TickResult {
  const events: SessionEvent[] = [
    ...state.events,
    { type: 'rest_end', atMs: state.sessionMs },
  ];
  return startNextMove({ ...state, events });
}

function startNextMove(state: PlayerState): TickResult {
  const moveIndex = state.moveIndex + 1;
  const move = state.plan.moves[moveIndex];
  const events: SessionEvent[] = [
    ...state.events,
    { type: 'move_start', atMs: state.sessionMs, moveId: move.exercise.id, name: move.exercise.name },
  ];
  return {
    state: { ...state, moveIndex, phase: 'work', phaseMs: 0, events },
    effects: [{ kind: 'speak', text: `${move.exercise.cue} ${move.workSeconds} seconds.` }],
  };
}

/**
 * Advance the player by deltaMs of wall-clock time. Handles boundary
 * crossings (work→rest→next move) within a single large delta, and emits
 * 3-2-1 countdown cues in the last seconds of each work interval.
 */
export function tick(state: PlayerState, deltaMs: number): TickResult {
  if (deltaMs <= 0 || state.phase === 'idle') {
    return { state, effects: [] };
  }
  let current: PlayerState = { ...state, sessionMs: state.sessionMs + deltaMs };
  const effects: SpeakEffect[] = [];
  if (current.phase === 'done' || current.paused) {
    return { state: current, effects };
  }

  let remainingDelta = deltaMs;
  // Rewind sessionMs; we re-add it as we consume the delta so that events
  // fired at phase boundaries carry the session time of the boundary itself.
  current = { ...current, sessionMs: state.sessionMs };

  while (remainingDelta > 0 && (current.phase === 'work' || current.phase === 'rest')) {
    const move = currentMove(current);
    const phaseTotalMs =
      (current.phase === 'work' ? move.workSeconds : move.restSeconds) * 1000;
    const phaseLeftMs = phaseTotalMs - current.phaseMs;
    const step = Math.min(remainingDelta, phaseLeftMs);

    const beforeLeft = phaseLeftMs;
    const afterLeft = phaseLeftMs - step;
    current = {
      ...current,
      sessionMs: current.sessionMs + step,
      phaseMs: current.phaseMs + step,
    };
    remainingDelta -= step;

    if (current.phase === 'work') {
      for (const s of [3, 2, 1]) {
        if (beforeLeft > s * 1000 && afterLeft <= s * 1000) {
          effects.push({ kind: 'speak', text: String(s) });
        }
      }
    }

    if (afterLeft <= 0) {
      const result =
        current.phase === 'work' ? finishWork(current) : finishRest(current);
      current = result.state;
      effects.push(...result.effects);
    }
  }

  // Any delta left after the session finished still advances the clock.
  if (remainingDelta > 0) {
    current = { ...current, sessionMs: current.sessionMs + remainingDelta };
  }
  return { state: current, effects };
}
