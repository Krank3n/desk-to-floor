import { render, screen, userEvent } from '@testing-library/react-native';

import { buildEventLog } from '@/lib/eventlog';
import { getEventLog } from '@/lib/session-store';
import SessionDetailScreen from '@/screens/session-detail-screen';
import { useVideoPlayer } from 'expo-video';

let mockParams: { id: string } = { id: 'abc123' };
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/lib/session-store', () => ({
  getEventLog: jest.fn(),
  sessionVideoPath: (file: string) => `file:///doc/sessions/${file}`,
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({})),
  VideoView: () => null,
}));

const baseLog = buildEventLog({
  sessionId: 'abc123',
  startedAt: '2026-08-21T09:30:00.000Z',
  appVersion: '0.7.0',
  plan: { name: 'Undesk · Week 1', moveIds: ['wrist-rocks', 'crow-hold'] },
  events: [
    { type: 'session_start', atMs: 0 },
    { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
    { type: 'move_end', atMs: 40000, moveId: 'wrist-rocks' },
    { type: 'session_end', atMs: 40000 },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'abc123' };
});

describe('SessionDetailScreen', () => {
  it('shows a not-found state for an unknown session', async () => {
    (getEventLog as jest.Mock).mockResolvedValueOnce(null);
    await render(<SessionDetailScreen />);
    expect(await screen.findByText('Session not found')).toBeOnTheScreen();
  });

  it('shows the plan, moves, and a no-footage note when there is no recording', async () => {
    (getEventLog as jest.Mock).mockResolvedValueOnce(baseLog);
    await render(<SessionDetailScreen />);
    expect(await screen.findByText('Undesk · Week 1')).toBeOnTheScreen();
    expect(screen.getByText('Wrist rocks')).toBeOnTheScreen();
    expect(screen.getByText('Crow progression')).toBeOnTheScreen();
    expect(
      screen.getByText('No footage recorded for this session.'),
    ).toBeOnTheScreen();
    expect(useVideoPlayer).not.toHaveBeenCalled();
  });

  it('plays back the footage when the session has a recording', async () => {
    (getEventLog as jest.Mock).mockResolvedValueOnce({
      ...baseLog,
      recording: { file: 'session-abc123.mp4', startOffsetMs: 0 },
    });
    await render(<SessionDetailScreen />);
    await screen.findByText('Undesk · Week 1');
    expect(
      screen.queryByText('No footage recorded for this session.'),
    ).toBeNull();
    expect(useVideoPlayer).toHaveBeenCalledWith(
      'file:///doc/sessions/session-abc123.mp4',
    );
  });

  it('goes back on Back', async () => {
    (getEventLog as jest.Mock).mockResolvedValueOnce(baseLog);
    const user = userEvent.setup();
    await render(<SessionDetailScreen />);
    await screen.findByText('Undesk · Week 1');
    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
