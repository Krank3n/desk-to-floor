import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { getApiKey, setApiKey } from '@/lib/api-key';
import { generateCoachWeek } from '@/lib/coach-client';
import { loadCoachWeek, saveCoachWeek } from '@/lib/coach-store';
import { getExercise } from '@/lib/exercises';
import CoachScreen from '@/screens/coach-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/api-key', () => ({
  ...jest.requireActual('@/lib/api-key'),
  getApiKey: jest.fn(),
  setApiKey: jest.fn().mockResolvedValue(undefined),
  clearApiKey: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/lib/coach-client', () => ({
  generateCoachWeek: jest.fn(),
  CoachRequestError: class extends Error {},
}));

jest.mock('@/lib/coach-store', () => ({
  loadCoachWeek: jest.fn(),
  saveCoachWeek: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/session-store', () => ({
  listEventLogs: jest.fn().mockResolvedValue([]),
}));

const VALID = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';

const move = (id: string) => ({
  exercise: getExercise(id),
  workSeconds: 40,
  restSeconds: 10,
});

const generatedWeek = {
  week: 5,
  phase: 'Get down' as const,
  notes: 'Wrists held up, so floor work starts this week.',
  rejectedMoveIds: [],
  generatedAt: '2026-08-25T09:00:00.000Z',
  sessions: [
    {
      name: 'Get down · Day 1',
      week: 5,
      phase: 'Get down' as const,
      moves: [move('wrist-rocks'), move('six-step-half-speed')],
      totalSeconds: 100,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  (getApiKey as jest.Mock).mockResolvedValue(null);
  (loadCoachWeek as jest.Mock).mockResolvedValue(null);
});

describe('CoachScreen', () => {
  it('asks for a key before it will generate anything', async () => {
    await render(<CoachScreen />);
    expect(await screen.findByText('Add a key first')).toBeOnTheScreen();
    expect(screen.getByLabelText('API key')).toBeOnTheScreen();
  });

  it('rejects a malformed key without storing it', async () => {
    const user = userEvent.setup();
    await render(<CoachScreen />);
    await user.type(screen.getByLabelText('API key'), 'hunter2');
    await user.press(screen.getByRole('button', { name: 'Save key' }));
    expect(screen.getByText(/does not look like an Anthropic key/)).toBeOnTheScreen();
    expect(setApiKey).not.toHaveBeenCalled();
  });

  it('stores a valid key and masks it', async () => {
    const user = userEvent.setup();
    await render(<CoachScreen />);
    await user.type(screen.getByLabelText('API key'), VALID);
    await user.press(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(() => expect(setApiKey).toHaveBeenCalledWith(VALID));
    // The stored key is never rendered in full.
    expect(screen.queryByText(VALID)).not.toBeOnTheScreen();
    expect(screen.getByText(/^sk-ant-api…/)).toBeOnTheScreen();
  });

  describe('with a key already stored', () => {
    beforeEach(() => {
      (getApiKey as jest.Mock).mockResolvedValue(VALID);
    });

    it('generates a week, saves it, and shows the coach’s reasoning', async () => {
      (generateCoachWeek as jest.Mock).mockResolvedValue(generatedWeek);
      const user = userEvent.setup();
      await render(<CoachScreen />);
      await user.press(
        await screen.findByRole('button', { name: 'Generate this week' }),
      );
      await waitFor(() => expect(saveCoachWeek).toHaveBeenCalledWith(generatedWeek));
      expect(screen.getByText(/floor work starts this week/)).toBeOnTheScreen();
      expect(screen.getByText('Get down · Day 1')).toBeOnTheScreen();
      expect(screen.getByText(/Wrist rocks — 40s/)).toBeOnTheScreen();
      expect(generateCoachWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          progressionNotes: expect.stringContaining('No prior sessions'),
        }),
      );
    });

    it('surfaces an API failure instead of failing silently', async () => {
      (generateCoachWeek as jest.Mock).mockRejectedValue(
        new Error('That API key was rejected.'),
      );
      const user = userEvent.setup();
      await render(<CoachScreen />);
      await user.press(
        await screen.findByRole('button', { name: 'Generate this week' }),
      );
      expect(
        await screen.findByText('That API key was rejected.'),
      ).toBeOnTheScreen();
      expect(saveCoachWeek).not.toHaveBeenCalled();
    });

    it('warns when the coach asked for moves the library does not have', async () => {
      (generateCoachWeek as jest.Mock).mockResolvedValue({
        ...generatedWeek,
        rejectedMoveIds: ['windmill'],
      });
      const user = userEvent.setup();
      await render(<CoachScreen />);
      await user.press(
        await screen.findByRole('button', { name: 'Generate this week' }),
      );
      expect(await screen.findByText(/Ignored 1 unknown move/)).toBeOnTheScreen();
      expect(screen.getByText(/windmill/)).toBeOnTheScreen();
    });
  });

  it('shows a previously generated week on open', async () => {
    (getApiKey as jest.Mock).mockResolvedValue(VALID);
    (loadCoachWeek as jest.Mock).mockResolvedValue(generatedWeek);
    await render(<CoachScreen />);
    expect(await screen.findByText('Get down · Day 1')).toBeOnTheScreen();
    expect(screen.getByText('Week 5')).toBeOnTheScreen();
  });
});
