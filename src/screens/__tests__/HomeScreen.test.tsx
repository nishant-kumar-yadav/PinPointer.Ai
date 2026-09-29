/**
 * Tests for HomeScreen — the app's home/landing screen.
 *
 * Strategy: the only collaborator that matters here is the shared pinpointer
 * state, so `usePinpointerShared` is mocked with a realistic, controllable
 * state object. The real `FeatureCard` component is rendered (it is a pure
 * presentational component); navigation is a plain jest.fn() prop.
 * Sync-animation internals (Animated loops) are left real — they must not
 * crash or hang the test run.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HomeScreen } from '../HomeScreen';
import { RootStackParamList } from '../../navigation/types';
import { usePinpointerShared } from '../../hooks/PinpointerContext';

jest.mock('../../hooks/PinpointerContext', () => ({
  usePinpointerShared: jest.fn(),
}));

const usePinpointerSharedMock = usePinpointerShared as jest.Mock;

/** The slice of shared state that HomeScreen actually consumes. */
interface SharedSyncState {
  isSyncing: boolean;
  isSyncingDocs: boolean;
  handleDeepSync: jest.Mock;
  handleDocumentSync: jest.Mock;
  syncCount: number;
  totalImages: number;
  docSyncCount: number;
  totalDocs: number;
}

const makeState = (overrides: Partial<SharedSyncState> = {}): SharedSyncState => ({
  isSyncing: false,
  isSyncingDocs: false,
  handleDeepSync: jest.fn(),
  handleDocumentSync: jest.fn(),
  syncCount: 0,
  totalImages: 0,
  docSyncCount: 0,
  totalDocs: 0,
  ...overrides,
});

type HomeNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

const makeNavigation = (): { navigation: HomeNavProp; navigate: jest.Mock } => {
  const navigate = jest.fn();
  const navigation = { navigate } as unknown as HomeNavProp;
  return { navigation, navigate };
};

interface RenderOpts {
  state?: Partial<SharedSyncState>;
  onCloseDrawer?: () => void;
  navigation?: HomeNavProp;
}

const renderHome = async (opts: RenderOpts = {}) => {
  usePinpointerSharedMock.mockReturnValue(makeState(opts.state));
  const nav = opts.navigation ?? makeNavigation().navigation;
  return render(<HomeScreen navigation={nav} onCloseDrawer={opts.onCloseDrawer} />);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HomeScreen — idle rendering', () => {
  test('renders the header quote', async () => {
    const { getByText } = await renderHome();
    expect(getByText('INDEXED. OFFLINE. YOURS.')).toBeTruthy();
  });

  test('renders all four feature cards with titles and subtitles', async () => {
    const { getByText } = await renderHome();
    expect(getByText('Scan Images')).toBeTruthy();
    expect(getByText('Image to Text')).toBeTruthy();
    expect(getByText('Recent searches')).toBeTruthy();
    expect(getByText('Gallery & History')).toBeTruthy();
    expect(getByText('Doc Vault')).toBeTruthy();
    expect(getByText('AI-Classified')).toBeTruthy();
    expect(getByText('Universal Sync')).toBeTruthy();
    expect(getByText('Index Entire Device')).toBeTruthy();
  });

  test('renders the privacy banner', async () => {
    const { getByText } = await renderHome();
    expect(getByText('Privacy-First On-Device AI')).toBeTruthy();
    expect(
      getByText('All AI processing happens locally on your device. No data ever leaves your phone.')
    ).toBeTruthy();
  });

  test('does not show any sync loading UI when idle', async () => {
    const { queryByText } = await renderHome();
    expect(queryByText('Analyzing images on-device...')).toBeNull();
    expect(queryByText('Analyzing docs on-device...')).toBeNull();
  });
});

describe('HomeScreen — navigation', () => {
  test('pressing Scan Images navigates to SmartClipboard', async () => {
    const { navigation, navigate } = makeNavigation();
    const { getByText } = await renderHome({ navigation });
    await fireEvent.press(getByText('Scan Images'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('SmartClipboard');
  });

  test('pressing Recent searches navigates to Gallery', async () => {
    const { navigation, navigate } = makeNavigation();
    const { getByText } = await renderHome({ navigation });
    await fireEvent.press(getByText('Recent searches'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('Gallery');
  });

  test('pressing Doc Vault navigates to DocumentVault', async () => {
    const { navigation, navigate } = makeNavigation();
    const { getByText } = await renderHome({ navigation });
    await fireEvent.press(getByText('Doc Vault'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('DocumentVault');
  });

  test('pressing Universal Sync triggers both syncs instead of navigating', async () => {
    const { navigation, navigate } = makeNavigation();
    const handleDeepSync = jest.fn();
    const handleDocumentSync = jest.fn();
    const { getByText } = await renderHome({
      navigation,
      state: { handleDeepSync, handleDocumentSync },
    });
    await fireEvent.press(getByText('Universal Sync'));
    expect(handleDeepSync).toHaveBeenCalledTimes(1);
    expect(handleDocumentSync).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('calls onCloseDrawer before navigating when the drawer handler is provided', async () => {
    const { navigation, navigate } = makeNavigation();
    const onCloseDrawer = jest.fn();
    const { getByText } = await renderHome({ navigation, onCloseDrawer });
    await fireEvent.press(getByText('Scan Images'));
    expect(onCloseDrawer).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('SmartClipboard');
    expect(onCloseDrawer.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]
    );
  });

  test('calls onCloseDrawer before triggering sync when provided', async () => {
    const { navigation } = makeNavigation();
    const onCloseDrawer = jest.fn();
    const handleDeepSync = jest.fn();
    const { getByText } = await renderHome({
      navigation,
      onCloseDrawer,
      state: { handleDeepSync },
    });
    await fireEvent.press(getByText('Universal Sync'));
    expect(onCloseDrawer).toHaveBeenCalledTimes(1);
    expect(handleDeepSync).toHaveBeenCalledTimes(1);
  });

  test('navigation works when onCloseDrawer is not provided', async () => {
    const { navigation, navigate } = makeNavigation();
    const { getByText } = await renderHome({ navigation });
    await fireEvent.press(getByText('Doc Vault'));
    expect(navigate).toHaveBeenCalledWith('DocumentVault');
  });
});

describe('HomeScreen — sync loading UI', () => {
  test('shows the image-sync loading UI when isSyncing', async () => {
    const { getByText, queryByText } = await renderHome({
      state: { isSyncing: true, syncCount: 150, totalImages: 300 },
    });
    expect(getByText('Analyzing images on-device...')).toBeTruthy();
    expect(getByText('100% private. No data leaves this device.')).toBeTruthy();
    // The Universal Sync card is replaced by the loading box.
    expect(queryByText('Universal Sync')).toBeNull();
  });

  test('shows the doc-sync loading UI when only isSyncingDocs', async () => {
    const { getByText, queryByText } = await renderHome({
      state: { isSyncingDocs: true, docSyncCount: 5, totalDocs: 10 },
    });
    expect(getByText('Analyzing docs on-device...')).toBeTruthy();
    expect(queryByText('Universal Sync')).toBeNull();
  });

  test('image sync text takes priority when both syncs are running', async () => {
    const { getByText, queryByText } = await renderHome({
      state: { isSyncing: true, isSyncingDocs: true },
    });
    expect(getByText('Analyzing images on-device...')).toBeTruthy();
    expect(queryByText('Analyzing docs on-device...')).toBeNull();
  });

  test('the other feature cards stay visible and usable during a sync', async () => {
    const { navigation, navigate } = makeNavigation();
    const { getByText } = await renderHome({
      navigation,
      state: { isSyncing: true, syncCount: 10, totalImages: 100 },
    });
    expect(getByText('Scan Images')).toBeTruthy();
    expect(getByText('Recent searches')).toBeTruthy();
    expect(getByText('Doc Vault')).toBeTruthy();
    await fireEvent.press(getByText('Recent searches'));
    expect(navigate).toHaveBeenCalledWith('Gallery');
  });

  test('handles zero totals without crashing (NaN-guard fallback)', async () => {
    const { getByText } = await renderHome({
      state: { isSyncing: true, syncCount: 0, totalImages: 0 },
    });
    expect(getByText('Analyzing images on-device...')).toBeTruthy();
  });

  test('handles doc sync with zero totalDocs without crashing', async () => {
    const { getByText } = await renderHome({
      state: { isSyncingDocs: true, docSyncCount: 0, totalDocs: 0 },
    });
    expect(getByText('Analyzing docs on-device...')).toBeTruthy();
  });
});

describe('HomeScreen — state transitions', () => {
  test('re-renders cleanly across idle → syncing → idle', async () => {
    const { getByText, queryByText, rerender } = await renderHome();
    expect(getByText('Universal Sync')).toBeTruthy();

    usePinpointerSharedMock.mockReturnValue(makeState({ isSyncing: true }));
    await rerender(<HomeScreen navigation={makeNavigation().navigation} />);
    expect(getByText('Analyzing images on-device...')).toBeTruthy();
    expect(queryByText('Universal Sync')).toBeNull();

    usePinpointerSharedMock.mockReturnValue(makeState({ isSyncing: false }));
    await rerender(<HomeScreen navigation={makeNavigation().navigation} />);
    expect(getByText('Universal Sync')).toBeTruthy();
    expect(queryByText('Analyzing images on-device...')).toBeNull();
  });

  test('uses the latest sync handlers after a state update', async () => {
    const firstDeepSync = jest.fn();
    const { getByText, rerender } = await renderHome({
      state: { handleDeepSync: firstDeepSync },
    });

    const secondDeepSync = jest.fn();
    usePinpointerSharedMock.mockReturnValue(makeState({ handleDeepSync: secondDeepSync }));
    await rerender(<HomeScreen navigation={makeNavigation().navigation} />);

    await fireEvent.press(getByText('Universal Sync'));
    expect(secondDeepSync).toHaveBeenCalledTimes(1);
    expect(firstDeepSync).not.toHaveBeenCalled();
  });

  test('switching from image sync to doc sync updates the loading copy', async () => {
    const { getByText, queryByText, rerender } = await renderHome({
      state: { isSyncing: true },
    });
    expect(getByText('Analyzing images on-device...')).toBeTruthy();

    usePinpointerSharedMock.mockReturnValue(
      makeState({ isSyncing: false, isSyncingDocs: true })
    );
    await rerender(<HomeScreen navigation={makeNavigation().navigation} />);
    expect(getByText('Analyzing docs on-device...')).toBeTruthy();
    expect(queryByText('Analyzing images on-device...')).toBeNull();
  });
});
