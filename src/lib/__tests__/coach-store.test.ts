import * as FileSystem from 'expo-file-system/legacy';

import { CoachWeek } from '@/lib/coach-plan';
import { loadCoachWeek, loadTodaysPlan, saveCoachWeek } from '@/lib/coach-store';
import { getExercise } from '@/lib/exercises';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

const move = (id: string) => ({
  exercise: getExercise(id),
  workSeconds: getExercise(id).workSeconds,
  restSeconds: getExercise(id).restSeconds,
});

const week: CoachWeek = {
  week: 5,
  phase: 'Get down',
  notes: 'Floor work starts.',
  rejectedMoveIds: [],
  generatedAt: '2026-08-25T09:00:00.000Z',
  sessions: [
    {
      name: 'Get down · Day 1',
      week: 5,
      phase: 'Get down',
      moves: [move('wrist-rocks'), move('six-step-half-speed')],
      totalSeconds: 135,
    },
  ],
};

beforeEach(() => jest.clearAllMocks());

describe('saveCoachWeek', () => {
  it('stores move ids, not serialized exercise objects', async () => {
    await saveCoachWeek(week);
    const written = JSON.parse(
      (fs.writeAsStringAsync as jest.Mock).mock.calls[0][1],
    );
    expect(written.sessions[0].moves[0]).toEqual({
      moveId: 'wrist-rocks',
      workSeconds: 40,
      restSeconds: 10,
    });
    expect(JSON.stringify(written)).not.toContain('cue');
  });
});

describe('loadCoachWeek', () => {
  it('round-trips a saved week, rehydrating from the library', async () => {
    await saveCoachWeek(week);
    const json = (fs.writeAsStringAsync as jest.Mock).mock.calls[0][1];
    fs.readAsStringAsync.mockResolvedValueOnce(json);
    const loaded = await loadCoachWeek();
    expect(loaded?.week).toBe(5);
    expect(loaded?.sessions[0].moves[0].exercise.cue).toBe(
      getExercise('wrist-rocks').cue,
    );
  });

  it('returns null when nothing has been generated', async () => {
    fs.readAsStringAsync.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(loadCoachWeek()).resolves.toBeNull();
  });

  it('drops moves the library no longer has', async () => {
    fs.readAsStringAsync.mockResolvedValueOnce(
      JSON.stringify({
        week: 5,
        notes: '',
        generatedAt: '2026-08-25T09:00:00.000Z',
        rejectedMoveIds: [],
        sessions: [
          {
            name: 'Day 1',
            moves: [
              { moveId: 'wrist-rocks', workSeconds: 40, restSeconds: 10 },
              { moveId: 'retired-move', workSeconds: 60, restSeconds: 20 },
            ],
          },
        ],
      }),
    );
    const loaded = await loadCoachWeek();
    expect(loaded?.sessions[0].moves.map((m) => m.exercise.id)).toEqual([
      'wrist-rocks',
    ]);
  });
});

describe('loadTodaysPlan', () => {
  it('prefers the coach session when a week exists', async () => {
    await saveCoachWeek(week);
    fs.readAsStringAsync.mockResolvedValueOnce(
      (fs.writeAsStringAsync as jest.Mock).mock.calls[0][1],
    );
    const today = await loadTodaysPlan();
    expect(today.fromCoach).toBe(true);
    expect(today.plan.name).toBe('Get down · Day 1');
  });

  it('falls back to the built-in template with no coach week', async () => {
    fs.readAsStringAsync.mockRejectedValueOnce(new Error('ENOENT'));
    const today = await loadTodaysPlan();
    expect(today.fromCoach).toBe(false);
    expect(today.plan.name).toBe('Undesk · Week 1');
  });
});
