import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import {
  deleteReferenceClip,
  hasReferenceClip,
  saveReferenceClip,
} from '@/lib/reference-clips-store';
import MoveDetailScreen from '@/screens/move-detail-screen';

let mockParams: { id: string } = { id: 'crow-hold' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/lib/reference-clips-store', () => ({
  hasReferenceClip: jest.fn(),
  saveReferenceClip: jest.fn().mockResolvedValue(undefined),
  deleteReferenceClip: jest.fn().mockResolvedValue(undefined),
  referenceClipPath: (id: string) => `file:///doc/reference-clips/ref-${id}.mp4`,
}));

const mockRecordAsync = jest
  .fn()
  .mockResolvedValue({ uri: 'file:///cache/clip.mp4' });
const mockStopRecording = jest.fn();
jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  return {
    CameraView: React.forwardRef(function CameraViewMock(
      _props: object,
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        recordAsync: mockRecordAsync,
        stopRecording: mockStopRecording,
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

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({})),
  VideoView: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'crow-hold' };
});

describe('MoveDetailScreen', () => {
  it('shows the record view with the move cue when no clip is saved', async () => {
    (hasReferenceClip as jest.Mock).mockResolvedValueOnce(false);
    await render(<MoveDetailScreen />);
    expect(await screen.findByText('Crow progression')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Start recording' }),
    ).toBeOnTheScreen();
  });

  it('records and saves a new clip, then switches to preview', async () => {
    (hasReferenceClip as jest.Mock).mockResolvedValueOnce(false);
    const user = userEvent.setup();
    await render(<MoveDetailScreen />);
    await user.press(
      await screen.findByRole('button', { name: 'Start recording' }),
    );
    expect(mockRecordAsync).toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Stop recording' }));
    expect(mockStopRecording).toHaveBeenCalled();
    await waitFor(() =>
      expect(saveReferenceClip).toHaveBeenCalledWith(
        'crow-hold',
        'file:///cache/clip.mp4',
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Retake' }),
    ).toBeOnTheScreen();
  });

  it('shows the saved clip and retakes back into record mode', async () => {
    (hasReferenceClip as jest.Mock).mockResolvedValueOnce(true);
    const user = userEvent.setup();
    await render(<MoveDetailScreen />);
    const retake = await screen.findByRole('button', { name: 'Retake' });
    await user.press(retake);
    expect(deleteReferenceClip).toHaveBeenCalledWith('crow-hold');
    expect(
      await screen.findByRole('button', { name: 'Start recording' }),
    ).toBeOnTheScreen();
  });

  it('shows a not-found state for an unknown move id', async () => {
    mockParams = { id: 'not-a-real-move' };
    await render(<MoveDetailScreen />);
    expect(await screen.findByText('Move not found')).toBeOnTheScreen();
  });
});
