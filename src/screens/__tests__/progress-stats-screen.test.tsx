import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { buildEventLog } from '@/lib/eventlog';
import { listEventLogs } from '@/lib/session-store';
import ProgressStatsScreen from '@/screens/progress-stats-screen';

const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) =>
      React.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/session-store', () => ({
  listEventLogs: jest.fn().mockResolvedValue([]),
}));

beforeEach(() => jest.clearAllMocks());

describe('ProgressStatsScreen', () => {
  it('shows the empty state for every tracked move by default', async () => {
    (listEventLogs as jest.Mock).mockResolvedValueOnce([]);
    await render(<ProgressStatsScreen />);
    expect(await screen.findByText('Wrist range')).toBeOnTheScreen();
    expect(screen.getByText('Squat hold')).toBeOnTheScreen();
    expect(screen.getByText('Crow hold')).toBeOnTheScreen();
    expect(screen.getByText('6-step tempo')).toBeOnTheScreen();
    expect(screen.getAllByText('No sessions logged yet')).toHaveLength(4);
  });

  it('summarizes a tracked move once it has been logged', async () => {
    const log = buildEventLog({
      sessionId: 's1',
      startedAt: '2026-08-20T09:00:00.000Z',
      appVersion: '0.6.0',
      plan: { name: 'Undesk', moveIds: ['crow-hold'] },
      events: [
        { type: 'session_start', atMs: 0 },
        { type: 'move_start', atMs: 0, moveId: 'crow-hold', name: 'Crow progression' },
        { type: 'move_end', atMs: 25000, moveId: 'crow-hold' },
        { type: 'session_end', atMs: 25000 },
      ],
    });
    (listEventLogs as jest.Mock).mockResolvedValueOnce([log]);
    await render(<ProgressStatsScreen />);
    expect(await screen.findByText(/Best 25s · Latest 25s/)).toBeOnTheScreen();
    expect(screen.getByText('25s')).toBeOnTheScreen();
  });

  it('goes back on Back', async () => {
    const user = userEvent.setup();
    await render(<ProgressStatsScreen />);
    await waitFor(() => expect(listEventLogs).toHaveBeenCalled());
    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
