import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { saveEventLog } from '@/lib/session-store';
import WorkoutScreen from '@/screens/workout-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('@/lib/session-store', () => ({
  saveEventLog: jest.fn().mockResolvedValue('mock://saved'),
}));

describe('WorkoutScreen', () => {
  it('shows the plan overview before beginning', async () => {
    await render(<WorkoutScreen />);
    expect(screen.getByRole('button', { name: 'Begin session' })).toBeOnTheScreen();
    expect(screen.getByText(/UNDESK · WEEK 1/)).toBeOnTheScreen();
    expect(screen.getByText(/Wrist rocks — 40s/)).toBeOnTheScreen();
  });

  it('begins the session, shows the first move, and speaks its cue', async () => {
    const user = userEvent.setup();
    await render(<WorkoutScreen />);
    await user.press(screen.getByRole('button', { name: 'Begin session' }));
    expect(screen.getByText('Wrist rocks')).toBeOnTheScreen();
    expect(screen.getByText('WORK')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.stringContaining('Wrist rocks'),
    );
  });

  it('pauses and resumes', async () => {
    const user = userEvent.setup();
    await render(<WorkoutScreen />);
    await user.press(screen.getByRole('button', { name: 'Begin session' }));
    await user.press(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
  });

  it('ends the session and saves the event log exactly once', async () => {
    const user = userEvent.setup();
    await render(<WorkoutScreen />);
    await user.press(screen.getByRole('button', { name: 'Begin session' }));
    await user.press(screen.getByRole('button', { name: 'End' }));
    expect(screen.getByText('SESSION COMPLETE')).toBeOnTheScreen();
    await waitFor(() => expect(saveEventLog).toHaveBeenCalledTimes(1));
    const log = (saveEventLog as jest.Mock).mock.calls[0][0];
    expect(log.schemaVersion).toBe(1);
    expect(log.events[0]).toEqual({ type: 'session_start', atMs: 0 });
    expect(log.events[log.events.length - 1].type).toBe('session_end');
  });
});
