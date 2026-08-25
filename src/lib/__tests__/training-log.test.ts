import { buildEventLog } from '@/lib/eventlog';
import { buildSessionTrainingLog, formatTrainingLog } from '@/lib/training-log';

const baseInput = {
  sessionId: '20260821T093000-4f2a9c',
  startedAt: '2026-08-21T09:30:00.000+10:00',
  appVersion: '0.4.1',
  plan: { name: 'Undesk · Week 1', moveIds: ['wrist-rocks', 'toprock-indian-step'] },
};

describe('buildSessionTrainingLog', () => {
  it('computes actual vs. planned work seconds for a clean session', () => {
    const log = buildEventLog({
      ...baseInput,
      events: [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
        { type: 'move_end', atMs: 42000, moveId: 'wrist-rocks' },
        { type: 'rest_start', atMs: 42000, durationMs: 10000 },
        { type: 'rest_end', atMs: 52000 },
        {
          type: 'move_start',
          atMs: 52000,
          moveId: 'toprock-indian-step',
          name: 'Toprock: Indian step',
        },
        { type: 'move_end', atMs: 112000, moveId: 'toprock-indian-step' },
        { type: 'session_end', atMs: 112000 },
      ],
    });

    const summary = buildSessionTrainingLog(log);
    expect(summary.durationSeconds).toBe(112);
    expect(summary.pauseCount).toBe(0);
    expect(summary.plannedMoveCount).toBe(2);
    expect(summary.completedMoveCount).toBe(2);
    expect(summary.moves).toEqual([
      {
        moveId: 'wrist-rocks',
        name: 'Wrist rocks',
        category: 'wrist-prep',
        plannedWorkSeconds: 40,
        actualWorkSeconds: 42,
        redoCount: 0,
        completed: true,
      },
      {
        moveId: 'toprock-indian-step',
        name: 'Toprock: Indian step',
        category: 'toprock',
        plannedWorkSeconds: 60,
        actualWorkSeconds: 60,
        redoCount: 0,
        completed: true,
      },
    ]);
  });

  it('discards the botched take before a redo marker', () => {
    const log = buildEventLog({
      ...baseInput,
      events: [
        { type: 'session_start', atMs: 0 },
        {
          type: 'move_start',
          atMs: 0,
          moveId: 'toprock-indian-step',
          name: 'Toprock: Indian step',
        },
        { type: 'redo', atMs: 20000, moveId: 'toprock-indian-step' },
        { type: 'move_end', atMs: 80000, moveId: 'toprock-indian-step' },
        { type: 'session_end', atMs: 80000 },
      ],
    });

    const summary = buildSessionTrainingLog(log);
    expect(summary.moves[0].actualWorkSeconds).toBe(60);
    expect(summary.moves[0].redoCount).toBe(1);
  });

  it('subtracts paused time from the move it interrupts', () => {
    const log = buildEventLog({
      ...baseInput,
      events: [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
        { type: 'pause', atMs: 10000 },
        { type: 'resume', atMs: 25000 },
        { type: 'move_end', atMs: 55000, moveId: 'wrist-rocks' },
        { type: 'session_end', atMs: 55000 },
      ],
    });

    const summary = buildSessionTrainingLog(log);
    expect(summary.pauseCount).toBe(1);
    expect(summary.moves[0].actualWorkSeconds).toBe(40);
  });

  it('marks a move ended by session_end as incomplete', () => {
    const log = buildEventLog({
      ...baseInput,
      events: [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
        { type: 'move_end', atMs: 40000, moveId: 'wrist-rocks' },
        {
          type: 'move_start',
          atMs: 40000,
          moveId: 'toprock-indian-step',
          name: 'Toprock: Indian step',
        },
        { type: 'session_end', atMs: 65000 },
      ],
    });

    const summary = buildSessionTrainingLog(log);
    expect(summary.completedMoveCount).toBe(1);
    expect(summary.moves[1]).toMatchObject({
      moveId: 'toprock-indian-step',
      actualWorkSeconds: 25,
      completed: false,
    });
  });

  it('falls back to unknown for a move id no longer in the exercise library', () => {
    const log = buildEventLog({
      ...baseInput,
      plan: { name: 'Retired move', moveIds: ['old-move'] },
      events: [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'old-move', name: 'Old move' },
        { type: 'move_end', atMs: 30000, moveId: 'old-move' },
        { type: 'session_end', atMs: 30000 },
      ],
    });

    const summary = buildSessionTrainingLog(log);
    expect(summary.moves[0].category).toBe('unknown');
    expect(summary.moves[0].plannedWorkSeconds).toBe(0);
  });
});

describe('formatTrainingLog', () => {
  it('reports no sessions logged yet for an empty list', () => {
    expect(formatTrainingLog([])).toBe('No sessions logged yet.');
  });

  it('renders sessions oldest-first as plain text', () => {
    const older = buildSessionTrainingLog(
      buildEventLog({
        ...baseInput,
        sessionId: 'a',
        startedAt: '2026-08-19T09:30:00.000+10:00',
        events: [
          { type: 'session_start', atMs: 0 },
          { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
          { type: 'move_end', atMs: 40000, moveId: 'wrist-rocks' },
          { type: 'session_end', atMs: 40000 },
        ],
      }),
    );
    const newer = buildSessionTrainingLog(
      buildEventLog({
        ...baseInput,
        sessionId: 'b',
        startedAt: '2026-08-21T09:30:00.000+10:00',
        events: [
          { type: 'session_start', atMs: 0 },
          {
            type: 'move_start',
            atMs: 0,
            moveId: 'toprock-indian-step',
            name: 'Toprock: Indian step',
          },
          { type: 'redo', atMs: 5000, moveId: 'toprock-indian-step' },
          { type: 'move_end', atMs: 65000, moveId: 'toprock-indian-step' },
          { type: 'session_end', atMs: 65000 },
        ],
      }),
    );

    // Pass newer first to prove the formatter sorts, not just echoes input order.
    const text = formatTrainingLog([newer, older]);

    expect(text).toBe(
      [
        'Training log — 2 sessions',
        '',
        '## 2026-08-19 · Undesk · Week 1 — 0m40s, 1/2 moves completed',
        '- Wrist rocks (wrist-prep): 40s / 40s planned',
        '',
        '## 2026-08-21 · Undesk · Week 1 — 1m05s, 1/2 moves completed',
        '- Toprock: Indian step (toprock): 60s / 60s planned, 1 redo',
      ].join('\n'),
    );
  });
});
