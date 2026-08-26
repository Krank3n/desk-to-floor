import { render, screen, userEvent } from '@testing-library/react-native';

import { EXERCISES } from '@/lib/exercises';
import { listReferenceClipIds } from '@/lib/reference-clips-store';
import MovesScreen from '@/screens/moves-screen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) =>
      React.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/reference-clips-store', () => ({
  listReferenceClipIds: jest.fn().mockResolvedValue(new Set()),
}));

beforeEach(() => jest.clearAllMocks());

describe('MovesScreen', () => {
  it('lists every exercise as "No clip" by default', async () => {
    (listReferenceClipIds as jest.Mock).mockResolvedValueOnce(new Set());
    await render(<MovesScreen />);
    expect(await screen.findByText('Wrist rocks')).toBeOnTheScreen();
    expect(screen.getAllByText('No clip')).toHaveLength(EXERCISES.length);
  });

  it('marks moves that already have a saved clip', async () => {
    (listReferenceClipIds as jest.Mock).mockResolvedValueOnce(
      new Set(['crow-hold']),
    );
    await render(<MovesScreen />);
    expect(await screen.findByText('Saved')).toBeOnTheScreen();
    expect(screen.getAllByText('No clip')).toHaveLength(EXERCISES.length - 1);
  });

  it('navigates to the move detail route on tap', async () => {
    const user = userEvent.setup();
    await render(<MovesScreen />);
    await user.press(await screen.findByText('Wrist rocks'));
    expect(mockPush).toHaveBeenCalledWith('/moves/wrist-rocks');
  });

  it('goes back on Back', async () => {
    const user = userEvent.setup();
    await render(<MovesScreen />);
    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
