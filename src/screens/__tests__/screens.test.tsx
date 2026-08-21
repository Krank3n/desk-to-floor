import { render, screen, waitFor } from '@testing-library/react-native';

import { listSessionSummaries } from '@/lib/session-store';
import SessionsScreen from '@/screens/sessions-screen';
import SettingsScreen from '@/screens/settings-screen';
import TrainScreen from '@/screens/train-screen';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) =>
      React.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/session-store', () => ({
  listSessionSummaries: jest.fn().mockResolvedValue([]),
  saveSession: jest.fn().mockResolvedValue('mock://saved'),
}));

describe('TrainScreen', () => {
  it('shows the brand and today’s generated session', async () => {
    await render(<TrainScreen />);
    expect(screen.getByText('DESK → FLOOR')).toBeOnTheScreen();
    expect(screen.getByText('Ready to train')).toBeOnTheScreen();
    expect(screen.getByText('Undesk · Week 1')).toBeOnTheScreen();
    expect(screen.getByText('Start session')).toBeOnTheScreen();
  });
});

describe('SessionsScreen', () => {
  it('shows the empty state before any sessions exist', async () => {
    await render(<SessionsScreen />);
    expect(screen.getByText('No sessions yet')).toBeOnTheScreen();
  });

  it('lists saved sessions', async () => {
    (listSessionSummaries as jest.Mock).mockResolvedValueOnce([
      {
        sessionId: 'abc',
        startedAt: '2026-08-21T09:30:00.000Z',
        name: 'Undesk · Week 1',
        moveCount: 10,
        durationMs: 600000,
        hasVideo: true,
      },
    ]);
    await render(<SessionsScreen />);
    await waitFor(() =>
      expect(screen.getByText('Undesk · Week 1')).toBeOnTheScreen(),
    );
    expect(screen.getByText(/10 moves/)).toBeOnTheScreen();
    expect(screen.getByText(/· video/)).toBeOnTheScreen();
  });
});

describe('SettingsScreen', () => {
  it('shows the app version and build channel', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Version')).toBeOnTheScreen();
    expect(screen.getByText('Channel')).toBeOnTheScreen();
    expect(screen.getByText('nightly')).toBeOnTheScreen();
  });
});
