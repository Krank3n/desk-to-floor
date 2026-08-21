import {
  buildEventLog,
  newSessionId,
  parseEventLog,
  SCHEMA_VERSION,
  serializeEventLog,
  SessionEvent,
  summarizeEventLog,
} from '@/lib/eventlog';

const baseInput = {
  sessionId: 'test-session',
  startedAt: '2026-08-21T09:30:00.000+10:00',
  appVersion: '0.2.0',
  plan: { name: 'Undesk · Week 1', moveIds: ['wrist-rocks'] },
};

const validEvents: SessionEvent[] = [
  { type: 'session_start', atMs: 0 },
  { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
  { type: 'move_end', atMs: 40000, moveId: 'wrist-rocks' },
  { type: 'session_end', atMs: 40000 },
];

describe('newSessionId', () => {
  it('is sortable, filename-safe, and unique enough', () => {
    const id = newSessionId(new Date('2026-08-21T09:30:00Z'));
    expect(id).toMatch(/^20260821T093000-[0-9a-f]{6}$/);
    expect(newSessionId()).not.toBe(newSessionId());
  });
});

describe('buildEventLog', () => {
  it('builds a v1 log with null recording/music placeholders', () => {
    const log = buildEventLog({ ...baseInput, events: validEvents });
    expect(log.schemaVersion).toBe(SCHEMA_VERSION);
    expect(log.recording).toBeNull();
    expect(log.music).toBeNull();
    expect(log.events).toHaveLength(4);
  });

  it('rejects non-monotonic events', () => {
    const events: SessionEvent[] = [
      { type: 'session_start', atMs: 0 },
      { type: 'move_start', atMs: 5000, moveId: 'x', name: 'X' },
      { type: 'move_end', atMs: 4000, moveId: 'x' },
    ];
    expect(() => buildEventLog({ ...baseInput, events })).toThrow(
      'not monotonic',
    );
  });

  it('rejects logs that do not begin with session_start', () => {
    const events: SessionEvent[] = [
      { type: 'move_start', atMs: 0, moveId: 'x', name: 'X' },
    ];
    expect(() => buildEventLog({ ...baseInput, events })).toThrow(
      'session_start',
    );
  });
});

describe('serialize/parse round trip', () => {
  it('round-trips losslessly', () => {
    const log = buildEventLog({ ...baseInput, events: validEvents });
    expect(parseEventLog(serializeEventLog(log))).toEqual(log);
  });

  it('hard-errors on an unknown schemaVersion', () => {
    const log = buildEventLog({ ...baseInput, events: validEvents });
    const tampered = serializeEventLog({ ...log, schemaVersion: 99 });
    expect(() => parseEventLog(tampered)).toThrow('schemaVersion 99');
  });
});

describe('summarizeEventLog', () => {
  it('reports name, move count, and duration from session_end', () => {
    const log = buildEventLog({ ...baseInput, events: validEvents });
    const summary = summarizeEventLog(log);
    expect(summary.name).toBe('Undesk · Week 1');
    expect(summary.moveCount).toBe(1);
    expect(summary.durationMs).toBe(40000);
    expect(summary.hasVideo).toBe(false);
  });
});
