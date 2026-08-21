/**
 * Event log v1 — see EVENTLOG.md, the app↔pipeline contract.
 * Any change here needs a schemaVersion bump and a migration note there.
 */
export const SCHEMA_VERSION = 1;

export type SessionEvent =
  | { type: 'session_start'; atMs: 0 }
  | { type: 'move_start'; atMs: number; moveId: string; name: string }
  | { type: 'move_end'; atMs: number; moveId: string }
  | { type: 'rest_start'; atMs: number; durationMs: number }
  | { type: 'rest_end'; atMs: number }
  | { type: 'redo'; atMs: number; moveId: string }
  | { type: 'pause'; atMs: number }
  | { type: 'resume'; atMs: number }
  | { type: 'session_end'; atMs: number };

export interface RecordingInfo {
  file: string;
  /** Session-clock ms at which the video's frame 0 was captured. */
  startOffsetMs: number;
}

export interface MusicInfo {
  track: string;
  bpm: number;
  beatGridStartMs: number;
  phraseBeats: number;
}

export interface EventLog {
  schemaVersion: number;
  sessionId: string;
  /** Absolute wall-clock anchor, ISO 8601. Everything else is relative ms. */
  startedAt: string;
  appVersion: string;
  plan: { name: string; moveIds: string[] };
  recording: RecordingInfo | null;
  music: MusicInfo | null;
  events: SessionEvent[];
}

/**
 * Readable, sortable, filename-safe id: 20260821T093000-4f2a9c.
 * Uniqueness only needs to hold per device; not cryptographic.
 */
export function newSessionId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..*$/, '');
  const suffix = Math.random().toString(16).slice(2, 8).padEnd(6, '0');
  return `${stamp}-${suffix}`;
}

export interface BuildEventLogInput {
  sessionId: string;
  startedAt: string;
  appVersion: string;
  plan: { name: string; moveIds: string[] };
  events: SessionEvent[];
  recording?: RecordingInfo | null;
  music?: MusicInfo | null;
}

export function buildEventLog(input: BuildEventLogInput): EventLog {
  const { events } = input;
  for (let i = 1; i < events.length; i++) {
    if (events[i].atMs < events[i - 1].atMs) {
      throw new Error(
        `Event log not monotonic: ${events[i].type}@${events[i].atMs} after ` +
          `${events[i - 1].type}@${events[i - 1].atMs}`,
      );
    }
  }
  if (events.length > 0 && events[0].type !== 'session_start') {
    throw new Error('Event log must begin with session_start');
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    appVersion: input.appVersion,
    plan: input.plan,
    recording: input.recording ?? null,
    music: input.music ?? null,
    events,
  };
}

export function serializeEventLog(log: EventLog): string {
  return JSON.stringify(log, null, 2);
}

/** Unknown schemaVersion is a hard error (EVENTLOG.md). */
export function parseEventLog(json: string): EventLog {
  const parsed = JSON.parse(json) as EventLog;
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported event log schemaVersion ${parsed.schemaVersion} ` +
        `(this build reads v${SCHEMA_VERSION})`,
    );
  }
  return parsed;
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  name: string;
  moveCount: number;
  durationMs: number;
}

export function summarizeEventLog(log: EventLog): SessionSummary {
  const end = [...log.events].reverse().find((e) => e.type === 'session_end');
  const last = log.events[log.events.length - 1];
  return {
    sessionId: log.sessionId,
    startedAt: log.startedAt,
    name: log.plan.name,
    moveCount: log.events.filter((e) => e.type === 'move_start').length,
    durationMs: end?.atMs ?? last?.atMs ?? 0,
  };
}
