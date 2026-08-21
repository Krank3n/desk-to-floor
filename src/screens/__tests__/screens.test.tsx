import { render, screen } from '@testing-library/react-native';

import SessionsScreen from '@/screens/sessions-screen';
import SettingsScreen from '@/screens/settings-screen';
import TrainScreen from '@/screens/train-screen';

describe('TrainScreen', () => {
  it('shows the brand and the M1 preview card', async () => {
    await render(<TrainScreen />);
    expect(screen.getByText('DESK → FLOOR')).toBeOnTheScreen();
    expect(screen.getByText('Ready to train')).toBeOnTheScreen();
    expect(screen.getByText('Undesk · Week 1')).toBeOnTheScreen();
  });
});

describe('SessionsScreen', () => {
  it('shows the empty state before any recordings exist', async () => {
    await render(<SessionsScreen />);
    expect(screen.getByText('No sessions yet')).toBeOnTheScreen();
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
