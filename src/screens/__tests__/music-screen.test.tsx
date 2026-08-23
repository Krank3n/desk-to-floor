import { render, screen, userEvent } from '@testing-library/react-native';

import { loadMusicSettings, saveMusicSettings } from '@/lib/music-settings';
import MusicScreen from '@/screens/music-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@/lib/music-settings', () => ({
  ...jest.requireActual('@/lib/music-settings'),
  loadMusicSettings: jest.fn(),
  saveMusicSettings: jest.fn().mockResolvedValue(undefined),
  importTrack: jest.fn(),
}));

const defaults = {
  trackUri: null,
  trackName: null,
  bpm: null,
  musicMode: false,
  phraseBeats: 8,
};

beforeEach(() => {
  jest.clearAllMocks();
  (loadMusicSettings as jest.Mock).mockResolvedValue(defaults);
});

afterEach(() => jest.restoreAllMocks());

describe('MusicScreen', () => {
  it('shows the empty state before a track and tempo are set', async () => {
    await render(<MusicScreen />);
    expect(screen.getByText('No track selected')).toBeOnTheScreen();
    expect(screen.getByText('— BPM')).toBeOnTheScreen();
    expect(screen.getByText('Needs a track and a tempo')).toBeOnTheScreen();
  });

  it('derives a BPM from four taps and persists it', async () => {
    // A steadily advancing clock: taps land on a uniform interval, so the
    // estimate is well-defined. (bpmFromTaps' exact arithmetic is covered in
    // music.test.ts; this test is about the screen wiring.)
    let now = 100000;
    jest.spyOn(Date, 'now').mockImplementation(() => (now += 300));

    const user = userEvent.setup();
    await render(<MusicScreen />);
    const tap = screen.getByRole('button', { name: 'Tap tempo' });
    await user.press(tap);
    await user.press(tap);
    await user.press(tap);
    await user.press(tap);

    expect(screen.getByText('Taps: 4')).toBeOnTheScreen();
    expect(screen.getByText(/^\d+(\.\d+)? BPM$/)).toBeOnTheScreen();
    expect(saveMusicSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ bpm: expect.any(Number) }),
    );
  });

  it('reset clears the tempo and switches music mode off', async () => {
    (loadMusicSettings as jest.Mock).mockResolvedValue({
      ...defaults,
      trackUri: 'file:///doc/music/t.mp3',
      trackName: 't.mp3',
      bpm: 92,
      musicMode: true,
    });
    const user = userEvent.setup();
    await render(<MusicScreen />);
    expect(await screen.findByText('92 BPM')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('— BPM')).toBeOnTheScreen();
    expect(saveMusicSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ bpm: null, musicMode: false }),
    );
  });
});
