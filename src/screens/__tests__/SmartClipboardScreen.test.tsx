/**
 * Tests for SmartClipboardScreen — the OCR "scan to clipboard" screen.
 *
 * Strategy (all through the rendered UI):
 *   - '../../utils/VisionPipeline' mocked (analyzeImage: jest.fn())
 *   - '../../database' mocked ({ indexDocument: jest.fn() })
 *   - '@react-navigation/native' mocked (useRoute/useNavigation: jest.fn(),
 *     wired per-test in beforeEach)
 *   - 'react-native-image-picker' and '@react-native-clipboard/clipboard'
 *     come from the repo's root __mocks__ (in-memory jest.fn()s).
 *   - Alert.alert / Share.share / Vibration.vibrate are spied per test.
 *
 * Ground-truth notes (verified against the source, not assumed):
 *   - Clipboard.getString is never called by this screen; there is no
 *     "read clipboard on mount" behavior to test.
 *   - buildIndexableContent is imported but never used by the screen.
 *   - handleSave (which calls indexDocument) is defined but NOT wired to
 *     any button, so it is unreachable through the UI and not tested here.
 *
 * RNTL v14: render / fireEvent / waitFor / act are async — await them.
 * fireEvent.press on a text node climbs the fiber tree to the wrapping
 * pressable, so buttons are pressed via their visible labels.
 */
import React from 'react';
import { Alert, Share, Vibration } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { SmartClipboardScreen } from '../SmartClipboardScreen';
import { analyzeImage, type VisionResult } from '../../utils/VisionPipeline';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';

jest.mock('../../utils/VisionPipeline', () => ({
  analyzeImage: jest.fn(),
}));
jest.mock('../../database', () => ({
  indexDocument: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(),
  useNavigation: jest.fn(),
}));

import { useNavigation, useRoute } from '@react-navigation/native';

const analyzeImageMock = analyzeImage as jest.Mock;
const launchCameraMock = launchCamera as jest.Mock;
const launchImageLibraryMock = launchImageLibrary as jest.Mock;
const clipboardSetStringMock = Clipboard.setString as jest.Mock;
const useRouteMock = useRoute as jest.Mock;
const useNavigationMock = useNavigation as jest.Mock;
const mockSetParams = jest.fn();

let mockRouteParams: { scanUri?: string } = {};

type Screen = Awaited<ReturnType<typeof render>>;

const PHOTO_URI = 'file:///photo.jpg';

const visionResult = (overrides: Partial<VisionResult> = {}): VisionResult => ({
  detection_type: 'TEXT',
  raw_text: '',
  content: '',
  search_index: [],
  optimized_status: '',
  embedding: null,
  ...overrides,
});

const mockCameraPhoto = (uri: string = PHOTO_URI): void => {
  launchCameraMock.mockResolvedValue({ assets: [{ uri }] });
};

let alertSpy: jest.SpyInstance;
let shareSpy: jest.SpyInstance;
let vibrateSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

/** Drive the full camera → analysis → result flow; resolves when result UI is up. */
const scanViaCamera = async (  rawText: string,
  detectionType: 'TEXT' | 'OBJECT' | 'EMPTY' = 'TEXT',
  uri: string = PHOTO_URI,
): Promise<Screen> => {
  mockCameraPhoto(uri);
  analyzeImageMock.mockResolvedValue(
    visionResult({ detection_type: detectionType, raw_text: rawText, content: rawText }),
  );
  const screen = await render(<SmartClipboardScreen />);
  await fireEvent.press(screen.getByText('Take Photo'));
  if (detectionType === 'EMPTY') {
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('No Text Found', expect.anything()),
    );
  } else {
    await waitFor(() => expect(analyzeImageMock).toHaveBeenCalledWith(uri));
    await waitFor(() => expect(screen.queryByText('Extracting text...')).toBeNull());
  }
  return screen;
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  shareSpy = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });
  vibrateSpy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});

  mockRouteParams = {};
  mockSetParams.mockClear();
  useRouteMock.mockReturnValue({ params: mockRouteParams });
  useNavigationMock.mockReturnValue({
    setParams: mockSetParams,
    navigate: jest.fn(),
    goBack: jest.fn(),
  });

  analyzeImageMock.mockReset();
  launchCameraMock.mockReset().mockResolvedValue({ assets: [] });
  launchImageLibraryMock.mockReset().mockResolvedValue({ assets: [] });
  clipboardSetStringMock.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SmartClipboardScreen', () => {
  describe('landing state', () => {
    test('renders the hero title, subtitle, and both action buttons', async () => {
      const screen = await render(<SmartClipboardScreen />);
      expect(screen.getByText('Smart Clipboard')).toBeTruthy();
      expect(
        screen.getByText(
          'Copy text from the real world — signs, books, labels, whiteboards',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Take Photo')).toBeTruthy();
      expect(screen.getByText('Pick from Gallery')).toBeTruthy();
    });

    test('shows no history section before anything is copied', async () => {
      const screen = await render(<SmartClipboardScreen />);
      expect(screen.queryByText('📌 Recent Clips')).toBeNull();
    });

    test('does not clear route params when no scanUri is provided', async () => {
      await render(<SmartClipboardScreen />);
      expect(mockSetParams).not.toHaveBeenCalled();
    });
  });

  describe('camera and gallery intents', () => {
    test('Take Photo calls launchCamera with the expected options', async () => {
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Take Photo'));
      expect(launchCameraMock).toHaveBeenCalledWith({
        mediaType: 'photo',
        quality: 0.5,
        maxWidth: 1024,
        maxHeight: 1024,
        saveToPhotos: false,
      });
    });

    test('Pick from Gallery calls launchImageLibrary with the expected options', async () => {
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Pick from Gallery'));
      expect(launchImageLibraryMock).toHaveBeenCalledWith({
        mediaType: 'photo',
        quality: 0.5,
        maxWidth: 1024,
        maxHeight: 1024,
      });
    });

    test('cancelled camera picker does not start analysis', async () => {
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Take Photo'));
      expect(launchCameraMock).toHaveBeenCalledTimes(1);
      expect(analyzeImageMock).not.toHaveBeenCalled();
      expect(screen.getByText('Take Photo')).toBeTruthy();
    });

    test('cancelled gallery picker does not start analysis', async () => {
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Pick from Gallery'));
      expect(launchImageLibraryMock).toHaveBeenCalledTimes(1);
      expect(analyzeImageMock).not.toHaveBeenCalled();
      expect(screen.getByText('Take Photo')).toBeTruthy();
    });

    test('camera failure logs an error and stays on landing', async () => {
      launchCameraMock.mockRejectedValue(new Error('permission denied'));
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Take Photo'));
      await waitFor(() =>
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SmartClipboard] Camera error:',
          expect.anything(),
        ),
      );
      expect(analyzeImageMock).not.toHaveBeenCalled();
      expect(screen.getByText('Take Photo')).toBeTruthy();
    });

    test('gallery failure logs an error and stays on landing', async () => {
      launchImageLibraryMock.mockRejectedValue(new Error('picker exploded'));
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Pick from Gallery'));
      await waitFor(() =>
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SmartClipboard] Gallery error:',
          expect.anything(),
        ),
      );
      expect(analyzeImageMock).not.toHaveBeenCalled();
      expect(screen.getByText('Take Photo')).toBeTruthy();
    });
  });

  describe('scan flow', () => {
    test('shows the processing indicator while OCR runs', async () => {
      let resolveAnalysis: (v: VisionResult) => void = () => {};
      analyzeImageMock.mockImplementation(
        () =>
          new Promise<VisionResult>((res) => {
            resolveAnalysis = res;
          }),
      );
      mockCameraPhoto();
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Take Photo'));
      await waitFor(() =>
        expect(screen.getByText('Extracting text...')).toBeTruthy(),
      );
      expect(
        screen.getByText('Running OCR (Hindi + English) on your image'),
      ).toBeTruthy();
      await act(async () => {
        resolveAnalysis(visionResult({ raw_text: 'Hi' }));
      });
      await waitFor(() =>
        expect(screen.queryByText('Extracting text...')).toBeNull(),
      );
    });

    test('successful TEXT scan shows the badge, editor text, char count, and vibrates', async () => {
      const screen = await scanViaCamera('Hello world');
      expect(analyzeImageMock).toHaveBeenCalledWith(PHOTO_URI);
      expect(screen.getByText('✅ Text Detected')).toBeTruthy();
      expect(screen.getByPlaceholderText('No text extracted...').props.value).toBe(
        'Hello world',
      );
      expect(screen.getByText('11 chars')).toBeTruthy();
      expect(vibrateSpy).toHaveBeenCalledWith(50);
    });

    test('OBJECT scan shows the objects badge', async () => {
      const screen = await scanViaCamera('a red car', 'OBJECT');
      expect(screen.getByText('🏷️ Objects Detected')).toBeTruthy();
      expect(screen.getByPlaceholderText('No text extracted...').props.value).toBe(
        'a red car',
      );
    });

    test('gallery scan works the same as a camera scan', async () => {
      launchImageLibraryMock.mockResolvedValue({ assets: [{ uri: 'file:///gallery.jpg' }] });
      analyzeImageMock.mockResolvedValue(visionResult({ raw_text: 'Gallery text' }));
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Pick from Gallery'));
      await waitFor(() =>
        expect(analyzeImageMock).toHaveBeenCalledWith('file:///gallery.jpg'),
      );
      await waitFor(() =>
        expect(screen.getByPlaceholderText('No text extracted...').props.value).toBe(
          'Gallery text',
        ),
      );
    });
  });

  describe('empty and error results', () => {
    test('EMPTY result alerts "No Text Found" and shows an empty editor', async () => {
      const screen = await scanViaCamera('', 'EMPTY');
      expect(alertSpy).toHaveBeenCalledWith(
        'No Text Found',
        'Could not detect any text or objects in this image. Try a clearer photo.',
      );
      const editor = screen.getByPlaceholderText('No text extracted...');
      expect(editor).toBeTruthy();
      expect(editor.props.value).toBe('');
    });

    test('analysis failure alerts "Scan Error", logs, and returns to landing', async () => {
      mockCameraPhoto();
      analyzeImageMock.mockRejectedValue(new Error('ocr exploded'));
      const screen = await render(<SmartClipboardScreen />);
      await fireEvent.press(screen.getByText('Take Photo'));
      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith(
          'Scan Error',
          'Failed to process the image. Please try again.',
        ),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SmartClipboard] OCR error:',
        expect.anything(),
      );
      await waitFor(() => expect(screen.getByText('Take Photo')).toBeTruthy());
      expect(screen.queryByText('Extracting text...')).toBeNull();
    });
  });

  describe('editing and copying', () => {
    test('editing the text updates the character count', async () => {
      const screen = await scanViaCamera('Hello world');
      const editor = screen.getByPlaceholderText('No text extracted...');
      await fireEvent.changeText(editor, 'Hi there');
      expect(screen.getByText('8 chars')).toBeTruthy();
    });

    test('Copy writes trimmed text to the clipboard, vibrates, toasts, and records history', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.press(screen.getByText('Copy'));
      expect(clipboardSetStringMock).toHaveBeenCalledWith('Hello world');
      expect(vibrateSpy).toHaveBeenCalledWith(30);
      expect(await screen.findByText('✅ Copied to clipboard!')).toBeTruthy();
      // History renders on the landing screen; go back to see it.
      await fireEvent.press(screen.getByText('Scan Another'));
      expect(screen.getByText('📌 Recent Clips')).toBeTruthy();
      expect(screen.getByText('Hello world')).toBeTruthy();
    });

    test('Copy uses the edited (not original) text', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.changeText(
        screen.getByPlaceholderText('No text extracted...'),
        'Edited text here',
      );
      await fireEvent.press(screen.getByText('Copy'));
      expect(clipboardSetStringMock).toHaveBeenCalledWith('Edited text here');
    });

    test('Copy trims surrounding whitespace', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.changeText(
        screen.getByPlaceholderText('No text extracted...'),
        '   padded   ',
      );
      await fireEvent.press(screen.getByText('Copy'));
      expect(clipboardSetStringMock).toHaveBeenCalledWith('padded');
    });

    test('Copy is a no-op for empty text', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.changeText(screen.getByPlaceholderText('No text extracted...'), '');
      await fireEvent.press(screen.getByText('Copy'));
      expect(clipboardSetStringMock).not.toHaveBeenCalled();
      expect(screen.queryByText('✅ Copied to clipboard!')).toBeNull();
      expect(screen.queryByText('📌 Recent Clips')).toBeNull();
    });

    test('Copy is a no-op for whitespace-only text', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.changeText(
        screen.getByPlaceholderText('No text extracted...'),
        '   ',
      );
      await fireEvent.press(screen.getByText('Copy'));
      expect(clipboardSetStringMock).not.toHaveBeenCalled();
    });
  });

  describe('clipboard history', () => {
    test('tapping a history item copies its text again', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.press(screen.getByText('Copy'));
      expect(clipboardSetStringMock).toHaveBeenCalledTimes(1);
      // History lives on the landing screen; go back to reach it.
      await fireEvent.press(screen.getByText('Scan Another'));
      await fireEvent.press(screen.getByText('Hello world'));
      expect(clipboardSetStringMock).toHaveBeenCalledTimes(2);
      expect(clipboardSetStringMock).toHaveBeenLastCalledWith('Hello world');
      expect(vibrateSpy).toHaveBeenCalledWith(30);
      expect(await screen.findByText('✅ Copied to clipboard!')).toBeTruthy();
    });

    test('Clear empties the history section', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.press(screen.getByText('Copy'));
      await fireEvent.press(screen.getByText('Scan Another'));
      expect(screen.getByText('📌 Recent Clips')).toBeTruthy();
      await fireEvent.press(screen.getByText('Clear'));
      expect(screen.queryByText('📌 Recent Clips')).toBeNull();
    });
  });

  describe('share and reset', () => {
    test('Share shares the trimmed edited text', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.press(screen.getByText('Share'));
      expect(shareSpy).toHaveBeenCalledWith({ message: 'Hello world' });
    });

    test('Share is a no-op for empty text', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.changeText(screen.getByPlaceholderText('No text extracted...'), '  ');
      await fireEvent.press(screen.getByText('Share'));
      expect(shareSpy).not.toHaveBeenCalled();
    });

    test('Scan Another resets back to the landing state', async () => {
      const screen = await scanViaCamera('Hello world');
      await fireEvent.press(screen.getByText('Scan Another'));
      expect(screen.getByText('Take Photo')).toBeTruthy();
      expect(screen.queryByText('✅ Text Detected')).toBeNull();
      expect(screen.queryByText('📌 Recent Clips')).toBeNull();
    });
  });

  describe('image preview modal', () => {
    /**
     * Minimal structural view of RNTL v14's element nodes
     * (screen.root = { instance } wrapping these host-node objects).
     */
    type HostNode = {
      type: unknown;
      props?: { source?: { uri?: string } } | null;
      children?: unknown;
      unstable_fiber?: unknown;
    };

    type FiberLike = {
      memoizedProps?: { onPress?: unknown } | null;
      return?: FiberLike | null;
    } | null;

    /** Recursively collect host nodes rendering an <Image source={{uri}}> match. */
    const findImagesByUri = (node: HostNode, uri: string): HostNode[] => {
      const found: HostNode[] = [];
      const visit = (current: HostNode): void => {
        if (current.props?.source?.uri === uri) found.push(current);
        const children = current.children;
        if (Array.isArray(children)) {
          for (const child of children) {
            if (child !== null && typeof child === 'object') {
              visit(child as HostNode);
            }
          }
        }
      };
      visit(node);
      return found;
    };

    /**
     * Press the nearest onPress above a node via its fiber ancestry.
     *
     * RNTL v14's fireEvent.press resolves handlers by climbing fibers but
     * stops at host-element boundaries, so it cannot reach the onPress of a
     * touchable whose child is a *direct* host child (e.g. the <Image>
     * preview or the ✕ label inside their TouchableOpacity wrappers).
     * Walking fiber.return manually reaches the same onPress prop that
     * React Native itself would invoke on a real tap.
     */
    const pressNearestOnPress = async (node: HostNode): Promise<void> => {
      let fiber = node.unstable_fiber as FiberLike;
      while (fiber) {
        const onPress = fiber.memoizedProps?.onPress;
        if (typeof onPress === 'function') {
          await act(async () => {
            (onPress as () => void)();
          });
          return;
        }
        fiber = fiber.return ?? null;
      }
      throw new Error('No onPress handler found above the pressed node');
    };

    /** Find the preview <Image> for the scanned photo. */
    const findPreviewImage = (screen: Screen): HostNode => {
      const hostRoot = (
        screen.root as unknown as { instance: HostNode } | null
      )?.instance;
      if (!hostRoot) throw new Error('render produced no root');
      const matches = findImagesByUri(hostRoot, PHOTO_URI);
      expect(matches).toHaveLength(1);
      return matches[0];
    };

    test('the result view shows a preview of the scanned photo', async () => {
      const screen = await scanViaCamera('Hello world');
      // Proves the preview <Image> renders the scanned photo's URI.
      findPreviewImage(screen);
    });

    test('tapping the preview opens the fullscreen modal, and ✕ closes it', async () => {
      const screen = await scanViaCamera('Hello world');
      await pressNearestOnPress(findPreviewImage(screen));
      expect(screen.getByText('✕')).toBeTruthy();
      await pressNearestOnPress(screen.getByText('✕') as unknown as HostNode);
      await waitFor(() => expect(screen.queryByText('✕')).toBeNull());
    });
  });

  describe('auto-scan from route params', () => {
    test('scanUri param is cleared and the image is processed after the transition delay', async () => {
      mockRouteParams = { scanUri: 'file:///deep.jpg' };
      useRouteMock.mockReturnValue({ params: mockRouteParams });
      analyzeImageMock.mockResolvedValue(visionResult({ raw_text: 'Deep text' }));
      const screen = await render(<SmartClipboardScreen />);
      expect(mockSetParams).toHaveBeenCalledWith({ scanUri: undefined });
      expect(screen.getByText('Extracting text...')).toBeTruthy();
      await waitFor(
        () => expect(analyzeImageMock).toHaveBeenCalledWith('file:///deep.jpg'),
        { timeout: 3000 },
      );
      await waitFor(
        () =>
          expect(screen.getByPlaceholderText('No text extracted...').props.value).toBe(
            'Deep text',
          ),
        { timeout: 3000 },
      );
    });
  });
});
