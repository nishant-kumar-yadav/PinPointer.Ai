/**
 * Component tests for GalleryScreen (src/screens/gallery.tsx).
 *
 * Strategy:
 *  - '../../utils/RecentPhotos' is mocked (getRecentPhotos: jest.fn()) so the
 *    grid is driven by a fixed, time-pinned photo corpus.
 *  - '@react-navigation/native' is mocked with a controllable navigation
 *    object (goBack / navigate spies).
 *  - Time fixtures are relative to the real clock at module load (no Date
 *    mocking): the screen derives its day filters from `new Date()`, so the
 *    corpus uses offsets from "now" and stays correct on any run date.
 *  - Grid photos are located through RNTL v14's custom test-renderer tree
 *    (screen.container.queryAll by host type name — the UNSAFE_* type queries
 *    were removed in v14); the back button is the single childless View
 *    (its Svg icon renders null); modal actions via accessibility labels.
 *  - Platform.OS is forced per-test for the share branches; Linking.openURL
 *    and Share.share are spied; StorageModule.shareImage comes from the
 *    repo's jest.setup.js stub.
 *
 * RNTL v14: render / fireEvent / waitFor are async and awaited.
 */
import React from 'react';
import {
  Linking,
  NativeModules,
  Platform,
  Share,
} from 'react-native';
import {
  render,
  fireEvent,
  waitFor,
  type RenderResult,
} from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import type { TestInstance } from 'test-renderer';

import { GalleryScreen } from '../gallery';
import { getRecentPhotos } from '../../utils/RecentPhotos';

jest.mock('../../utils/RecentPhotos', () => ({
  getRecentPhotos: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

// ─── Time + data fixtures ───────────────────────────────────────────────────

// All fixtures are relative to the real clock at module load: the screen
// computes startOfToday from `new Date()` (which a Date.now spy cannot pin),
// so pinning to a hard-coded date made this suite a time bomb that broke after
// midnight. Relative fixtures stay correct whenever the suite runs.
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const START_OF_TODAY = new Date(NOW).setHours(0, 0, 0, 0);

interface PhotoFixture {
  uri: string;
  viewedAt: number;
}

const PHOTOS: PhotoFixture[] = [
  { uri: 'file:///photos/today1.jpg', viewedAt: START_OF_TODAY + 60 * 60 * 1000 }, // today (01:00)
  { uri: 'file:///photos/today-midnight.jpg', viewedAt: START_OF_TODAY }, // today (boundary)
  { uri: 'file:///photos/yesterday1.jpg', viewedAt: START_OF_TODAY - 60 * 60 * 1000 }, // yesterday (23:00)
  { uri: 'file:///photos/yesterday-edge.jpg', viewedAt: START_OF_TODAY - DAY_MS }, // yesterday (boundary)
  { uri: 'file:///photos/lastweek1.jpg', viewedAt: START_OF_TODAY - 2 * DAY_MS }, // last week
  { uri: 'file:///photos/old.jpg', viewedAt: START_OF_TODAY - 10 * DAY_MS }, // last week (no lower bound)
];

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const getRecentPhotosMock = getRecentPhotos as jest.Mock;
const useNavigationMock = useNavigation as jest.Mock;
const shareImageMock = () =>
  (NativeModules.StorageModule as { shareImage: jest.Mock }).shareImage;

// ─── Helpers ────────────────────────────────────────────────────────────────
// RNTL v14 removed the UNSAFE_* type queries and renders through its own
// `test-renderer` package: composite components (e.g. TouchableOpacity) are
// flattened to host nodes, and each node's `type` is the host type name
// ("View", "Image", "Text", ...). Queries below use container.queryAll.

function treeOf(screen: RenderResult): TestInstance {
  return screen.container;
}

function imageUri(node: TestInstance): string {
  const source = node.props.source as { uri?: string } | undefined;
  return source?.uri ?? '';
}

function imagesIn(screen: RenderResult): TestInstance[] {
  return treeOf(screen).queryAll((n) => n.type === 'Image');
}

function renderedImageUris(screen: RenderResult): string[] {
  return imagesIn(screen).map(imageUri);
}

/**
 * The header back button is the only childless host View: its Svg icon
 * renders null under the repo's react-native-svg mock, leaving an empty
 * pressable. Throws if the assumption ever stops holding.
 */
function backButtonNode(screen: RenderResult): TestInstance {
  const matches = treeOf(screen).queryAll(
    (n) => n.type === 'View' && n.children.length === 0
  );
  if (matches.length !== 1) {
    throw new Error(`expected exactly one back button, found ${matches.length}`);
  }
  return matches[0];
}

async function renderGallery(): Promise<RenderResult> {
  const screen = await render(<GalleryScreen />);
  // Flush the getRecentPhotos().then(setAllPhotos) microtask.
  await waitFor(() => expect(getRecentPhotosMock).toHaveBeenCalled());
  return screen;
}

async function pressChip(screen: RenderResult, label: string): Promise<void> {
  await fireEvent.press(screen.getByText(label));
}

async function openPhoto(screen: RenderResult, uri: string): Promise<void> {
  await waitFor(() => {
    const found = imagesIn(screen).some((img) => imageUri(img) === uri);
    expect(found).toBe(true);
  });
  const img = imagesIn(screen).find((i) => imageUri(i) === uri);
  const card = img?.parent;
  if (!img || !card) {
    throw new Error(`photo card not found for ${uri}`);
  }
  // The card TouchableOpacity is the Image's direct parent.
  await fireEvent.press(card);
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('GalleryScreen', () => {
  const realOS = Platform.OS;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    jest.spyOn(Share, 'share').mockImplementation(async () => ({} as never));

    mockNavigate.mockClear();
    mockGoBack.mockClear();
    useNavigationMock.mockReturnValue({ navigate: mockNavigate, goBack: mockGoBack });
    getRecentPhotosMock.mockClear();
    getRecentPhotosMock.mockResolvedValue([...PHOTOS]);
    shareImageMock().mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (Platform as unknown as { OS: string }).OS = realOS;
  });

  test('renders the Gallery title and fetches recent photos on mount', async () => {
    const screen = await renderGallery();

    expect(await screen.findByText('Gallery')).toBeTruthy();
    expect(getRecentPhotosMock).toHaveBeenCalledTimes(1);
  });

  test('shows only today\u2019s photos in the grid by default', async () => {
    const screen = await renderGallery();

    await waitFor(() =>
      expect(renderedImageUris(screen).sort()).toEqual(
        ['file:///photos/today1.jpg', 'file:///photos/today-midnight.jpg'].sort()
      )
    );
  });

  test('back button calls navigation.goBack', async () => {
    const screen = await renderGallery();

    await fireEvent.press(backButtonNode(screen));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('Yesterday filter shows only yesterday\u2019s photos, boundary inclusive', async () => {
    const screen = await renderGallery();
    await pressChip(screen, 'Yesterday');

    await waitFor(() =>
      expect(renderedImageUris(screen).sort()).toEqual(
        ['file:///photos/yesterday1.jpg', 'file:///photos/yesterday-edge.jpg'].sort()
      )
    );
  });

  test('Last Week filter shows photos older than yesterday with no lower bound', async () => {
    const screen = await renderGallery();
    await pressChip(screen, 'Last Week');

    await waitFor(() =>
      expect(renderedImageUris(screen).sort()).toEqual(
        ['file:///photos/lastweek1.jpg', 'file:///photos/old.jpg'].sort()
      )
    );
  });

  test('switching filters back to Today restores today\u2019s photos', async () => {
    const screen = await renderGallery();
    await pressChip(screen, 'Last Week');
    await waitFor(() => expect(renderedImageUris(screen)).toHaveLength(2));

    await pressChip(screen, 'Today');
    await waitFor(() =>
      expect(renderedImageUris(screen).sort()).toEqual(
        ['file:///photos/today1.jpg', 'file:///photos/today-midnight.jpg'].sort()
      )
    );
  });

  test('does not refetch photos when switching filters', async () => {
    const screen = await renderGallery();
    await pressChip(screen, 'Yesterday');
    await pressChip(screen, 'Last Week');
    await pressChip(screen, 'Today');

    expect(getRecentPhotosMock).toHaveBeenCalledTimes(1);
  });

  test('photo exactly at the yesterday/last-week boundary is excluded from Last Week', async () => {
    const screen = await renderGallery();
    await pressChip(screen, 'Last Week');

    await waitFor(() =>
      expect(renderedImageUris(screen)).not.toContain('file:///photos/yesterday-edge.jpg')
    );
  });

  test('shows the empty state when there are no photos for today', async () => {
    getRecentPhotosMock.mockResolvedValue([]);
    const screen = await renderGallery();

    expect(
      await screen.findByText('No recent photos found for today.')
    ).toBeTruthy();
    expect(renderedImageUris(screen)).toHaveLength(0);
  });

  test('empty-state message follows the active filter', async () => {
    getRecentPhotosMock.mockResolvedValue([]);
    const screen = await renderGallery();

    await pressChip(screen, 'Yesterday');
    expect(
      await screen.findByText('No recent photos found for yesterday.')
    ).toBeTruthy();

    await pressChip(screen, 'Last Week');
    expect(
      await screen.findByText('No recent photos found for last week.')
    ).toBeTruthy();
  });

  test('tapping a photo opens the preview modal with that image', async () => {
    const screen = await renderGallery();
    await openPhoto(screen, 'file:///photos/today1.jpg');

    expect(await screen.findByLabelText('Close image')).toBeTruthy();
    // 2 grid images + 1 modal preview image.
    const modalImages = imagesIn(screen).filter(
      (i) => i.props.resizeMode === 'contain'
    );
    expect(modalImages).toHaveLength(1);
    expect(imageUri(modalImages[0])).toBe('file:///photos/today1.jpg');
  });

  test('close button dismisses the preview modal', async () => {
    const screen = await renderGallery();
    await openPhoto(screen, 'file:///photos/today1.jpg');
    expect(await screen.findByLabelText('Close image')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Close image'));
    await waitFor(() =>
      expect(screen.queryByLabelText('Close image')).toBeNull()
    );
    expect(renderedImageUris(screen)).toHaveLength(2);
  });

  test('scan action navigates to SmartClipboard with the photo uri and closes the modal', async () => {
    const screen = await renderGallery();
    await pressChip(screen, 'Yesterday');
    await openPhoto(screen, 'file:///photos/yesterday1.jpg');

    await fireEvent.press(await screen.findByLabelText('Scan image'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('SmartClipboard', {
      scanUri: 'file:///photos/yesterday1.jpg',
    });
    await waitFor(() =>
      expect(screen.queryByLabelText('Close image')).toBeNull()
    );
  });

  test('edit action opens the photo url via Linking', async () => {
    const screen = await renderGallery();
    await openPhoto(screen, 'file:///photos/today1.jpg');

    await fireEvent.press(await screen.findByLabelText('Edit image'));

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith('file:///photos/today1.jpg');
  });

  test('share action on Android uses the native StorageModule with the file:// prefix stripped', async () => {
    (Platform as unknown as { OS: string }).OS = 'android';
    const screen = await renderGallery();
    await openPhoto(screen, 'file:///photos/today1.jpg');

    await fireEvent.press(await screen.findByLabelText('Share image'));

    expect(shareImageMock()).toHaveBeenCalledTimes(1);
    expect(shareImageMock()).toHaveBeenCalledWith('/photos/today1.jpg');
    expect(Share.share).not.toHaveBeenCalled();
  });

  test('share action on iOS uses Share.share with the photo url', async () => {
    (Platform as unknown as { OS: string }).OS = 'ios';
    const screen = await renderGallery();
    await openPhoto(screen, 'file:///photos/today1.jpg');

    await fireEvent.press(await screen.findByLabelText('Share image'));

    expect(Share.share).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledWith({ url: 'file:///photos/today1.jpg' });
    expect(shareImageMock()).not.toHaveBeenCalled();
  });

  test('share action on Android falls back to Share.share when the native module is missing', async () => {
    (Platform as unknown as { OS: string }).OS = 'android';
    const storageModule = NativeModules.StorageModule as {
      shareImage?: jest.Mock;
    };
    const original = storageModule.shareImage;
    storageModule.shareImage = undefined;
    try {
      const screen = await renderGallery();
      await openPhoto(screen, 'file:///photos/today1.jpg');

      await fireEvent.press(await screen.findByLabelText('Share image'));

      expect(Share.share).toHaveBeenCalledTimes(1);
      expect(Share.share).toHaveBeenCalledWith({ url: 'file:///photos/today1.jpg' });
    } finally {
      storageModule.shareImage = original;
    }
  });

});
