import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { loadMusicSettings } from '@/lib/music-settings';
import { saveSession } from '@/lib/session-store';
import WorkoutScreen from '@/screens/workout-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
}));

const mockAudio = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  loop: false,
};
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockAudio,
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockRejectedValue(new Error('ENOENT')),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/music-settings', () => ({
  ...jest.requireActual('@/lib/music-settings'),
  loadMusicSettings: jest.fn(),
  saveMusicSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  return {
    CameraView: React.forwardRef(function CameraViewMock(
      _props: object,
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        recordAsync: jest
          .fn()
          .mockResolvedValue({ uri: 'file:///cache/video.mp4' }),
        stopRecording: jest.fn(),
      }));
      return null;
    }),
    useCameraPermissions: () => [
      { granted: true },
      jest.fn().mockResolvedValue({ granted: true }),
    ],
    useMicrophonePermissions: () => [
      { granted: true },
      jest.fn().mockResolvedValue({ granted: true }),
    ],
  };
});

jest.mock('@/lib/session-store', () => ({
  saveSession: jest.fn().mockResolvedValue('mock://saved'),
}));

const noMusic = {
  trackUri: null,
  trackName: null,
  bpm: null,
  musicMode: false,
  phraseBeats: 8,
};

const withMusic = {
  trackUri: 'file:///doc/music/track.mp3',
  trackName: 'track.mp3',
  bpm: 92,
  musicMode: true,
  phraseBeats: 8,
};

beforeEach(() => {
  jest.clearAllMocks();
  (loadMusicSettings as jest.Mock).mockResolvedValue(noMusic);
});

describe('WorkoutScreen', () => {
  it('shows the plan overview and the record toggle before beginning', async () => {
    await render(<WorkoutScreen />);
    expect(screen.getByRole('button', { name: 'Begin session' })).toBeOnTheScreen();
    expect(screen.getByText(/UNDESK · WEEK 1/)).toBeOnTheScreen();
    expect(screen.getByText('Record video')).toBeOnTheScreen();
  });

  it('begins the session recording, shows REC, and speaks the first cue', async () => {
    const user = userEvent.setup();
    await render(<WorkoutScreen />);
    await user.press(screen.getByRole('button', { name: 'Begin session' }));
    expect(screen.getByText('Wrist rocks')).toBeOnTheScreen();
    expect(screen.getByText('WORK')).toBeOnTheScreen();
    expect(screen.getByText('REC')).toBeOnTheScreen();
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.stringContaining('Wrist rocks'),
    );
  });

  it('marks a redo and keeps training', async () => {
    const user = userEvent.setup();
    await render(<WorkoutScreen />);
    await user.press(screen.getByRole('button', { name: 'Begin session' }));
    await user.press(screen.getByRole('button', { name: 'Redo' }));
    expect(Speech.speak).toHaveBeenCalledWith('Redo marked.');
    expect(screen.getByText('WORK')).toBeOnTheScreen();
  });

  it('ends the session and saves footage + log together', async () => {
    const user = userEvent.setup();
    await render(<WorkoutScreen />);
    await user.press(screen.getByRole('button', { name: 'Begin session' }));
    await user.press(screen.getByRole('button', { name: 'End' }));
    expect(screen.getByText('SESSION COMPLETE')).toBeOnTheScreen();
    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));
    const [log, video] = (saveSession as jest.Mock).mock.calls[0];
    expect(log.schemaVersion).toBe(1);
    expect(log.events[0]).toEqual({ type: 'session_start', atMs: 0 });
    expect(log.events[log.events.length - 1].type).toBe('session_end');
    expect(log.music).toBeNull();
    expect(video).toEqual({ uri: 'file:///cache/video.mp4', startOffsetMs: 0 });
  });

  describe('with music mode on', () => {
    beforeEach(() => {
      (loadMusicSettings as jest.Mock).mockResolvedValue(withMusic);
    });

    it('announces the track before starting and shows the tempo badge', async () => {
      const user = userEvent.setup();
      await render(<WorkoutScreen />);
      expect(await screen.findByText(/track\.mp3 at 92 BPM/)).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Begin session' }));
      expect(screen.getByText('92 BPM')).toBeOnTheScreen();
    });

    it('plays the track on begin and pauses it with the workout', async () => {
      const user = userEvent.setup();
      await render(<WorkoutScreen />);
      await screen.findByText(/track\.mp3 at 92 BPM/);
      await user.press(screen.getByRole('button', { name: 'Begin session' }));
      expect(mockAudio.play).toHaveBeenCalled();
      await user.press(screen.getByRole('button', { name: 'Pause' }));
      expect(mockAudio.pause).toHaveBeenCalled();
      await user.press(screen.getByRole('button', { name: 'Resume' }));
      expect(mockAudio.play).toHaveBeenCalledTimes(2);
    });

    it('writes the beat grid into the event log', async () => {
      const user = userEvent.setup();
      await render(<WorkoutScreen />);
      await screen.findByText(/track\.mp3 at 92 BPM/);
      await user.press(screen.getByRole('button', { name: 'Begin session' }));
      await user.press(screen.getByRole('button', { name: 'End' }));
      await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));
      const [log] = (saveSession as jest.Mock).mock.calls[0];
      expect(log.schemaVersion).toBe(1);
      expect(log.music).toEqual({
        track: 'track.mp3',
        bpm: 92,
        beatGridStartMs: 0,
        phraseBeats: 8,
      });
    });
  });
});
