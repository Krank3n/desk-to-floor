import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { EXERCISES } from '@/lib/exercises';
import { listReferenceClipIds } from '@/lib/reference-clips-store';
import { listSessionSummaries } from '@/lib/session-store';
import SessionsScreen from '@/screens/sessions-screen';
import SettingsScreen from '@/screens/settings-screen';
import TrainScreen from '@/screens/train-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) =>
      React.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/session-store', () => ({
  listSessionSummaries: jest.fn().mockResolvedValue([]),
  saveSession: jest.fn().mockResolvedValue('mock://saved'),
}));

jest.mock('@/lib/reference-clips-store', () => ({
  listReferenceClipIds: jest.fn().mockResolvedValue(new Set()),
}));

jest.mock('@/lib/music-settings', () => ({
  ...jest.requireActual('@/lib/music-settings'),
  loadMusicSettings: jest.fn().mockResolvedValue({
    trackUri: null,
    trackName: null,
    bpm: null,
    musicMode: false,
    phraseBeats: 8,
  }),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  readAsStringAsync: jest.fn().mockRejectedValue(new Error('ENOENT')),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
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

  it('navigates to the session detail route on tap', async () => {
    (listSessionSummaries as jest.Mock).mockResolvedValueOnce([
      {
        sessionId: 'abc123',
        startedAt: '2026-08-21T09:30:00.000Z',
        name: 'Undesk · Week 1',
        moveCount: 10,
        durationMs: 600000,
        hasVideo: true,
      },
    ]);
    const user = userEvent.setup();
    await render(<SessionsScreen />);
    await user.press(await screen.findByText('Undesk · Week 1'));
    expect(mockPush).toHaveBeenCalledWith('/sessions/abc123');
  });
});

describe('SettingsScreen', () => {
  it('shows the app version and build channel', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Version')).toBeOnTheScreen();
    expect(screen.getByText('Channel')).toBeOnTheScreen();
    expect(screen.getByText('nightly')).toBeOnTheScreen();
  });

  it('shows how many moves have a saved reference clip', async () => {
    (listReferenceClipIds as jest.Mock).mockResolvedValueOnce(
      new Set(['wrist-rocks', 'crow-hold']),
    );
    await render(<SettingsScreen />);
    expect(
      await screen.findByText(`2 of ${EXERCISES.length} saved ›`),
    ).toBeOnTheScreen();
  });

  it('has a row linking to progress stats', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Progress stats')).toBeOnTheScreen();
  });
});
