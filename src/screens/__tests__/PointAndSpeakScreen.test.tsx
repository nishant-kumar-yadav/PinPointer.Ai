/**
 * Component tests for PointAndSpeakScreen — the point-at-text OCR screen.
 *
 * Strategy:
 *   - `react-native-image-picker` comes from the repo's root `__mocks__`
 *     (launchCamera / launchImageLibrary are jest.fn, resolved per test).
 *   - `../utils/VisionPipeline` is mocked with a controllable analyzeImage.
 *   - `Vibration.vibrate` is a jest.fn via the react-native preset.
 *   - All flows are driven through the UI (press the on-screen buttons);
 *     RNTL v14 async APIs (render / fireEvent / waitFor / findBy*) are awaited.
 */

import React from 'react';
import { Vibration } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { analyzeImage } from '../../utils/VisionPipeline';
import type { VisionResult } from '../../utils/VisionPipeline';
import { PointAndSpeakScreen } from '../PointAndSpeakScreen';

jest.mock('../../utils/VisionPipeline', () => ({
    analyzeImage: jest.fn(),
}));

// ─── helpers ────────────────────────────────────────────────────────────────

const analyzeMock = analyzeImage as jest.Mock;
const launchCameraMock = launchCamera as jest.Mock;
const launchImageLibraryMock = launchImageLibrary as jest.Mock;
const vibrateMock = Vibration.vibrate as jest.Mock;

const visionResult = (overrides: Partial<VisionResult> = {}): VisionResult => ({
    detection_type: 'TEXT',
    raw_text: 'Detected text',
    content: 'Detected text',
    search_index: ['Detected text'],
    optimized_status: 'ok',
    embedding: null,
    ...overrides,
});

const cameraAsset = (uri = 'file:///camera/photo.jpg') => ({
    assets: [{ uri }],
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ─── idle state ─────────────────────────────────────────────────────────────

describe('PointAndSpeakScreen — idle state', () => {
    test('renders the title, capture button, gallery link, and info cards', async () => {
        const { getByText } = await render(<PointAndSpeakScreen />);

        expect(getByText('Point & Speak')).toBeTruthy();
        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
        expect(getByText('📁 Or pick from gallery')).toBeTruthy();
        expect(getByText('Works 100% Offline')).toBeTruthy();
        expect(getByText('Hindi + English')).toBeTruthy();
        expect(getByText('Accessibility First')).toBeTruthy();
    });
});

// ─── camera capture flow ────────────────────────────────────────────────────

describe('PointAndSpeakScreen — camera capture flow', () => {
    test('calls launchCamera with the expected options when the capture button is pressed', async () => {
        launchCameraMock.mockResolvedValue({ assets: [] });
        const { getByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await waitFor(() => {
            expect(launchCameraMock).toHaveBeenCalledWith({
                mediaType: 'photo',
                quality: 0.5,
                maxWidth: 1024,
                maxHeight: 1024,
                saveToPhotos: false,
            });
        });
    });

    test('runs OCR on the captured photo and shows the detected text', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset('file:///camera/sign.jpg'));
        analyzeMock.mockResolvedValue(visionResult({ raw_text: 'STOP — No Entry' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await waitFor(() => {
            expect(analyzeMock).toHaveBeenCalledWith('file:///camera/sign.jpg');
        });
        expect(await findByText('✅ Detected Text')).toBeTruthy();
        expect(await findByText('STOP — No Entry')).toBeTruthy();
    });

    test('shows the scanning UI while OCR is in progress', async () => {
        let resolveAnalysis!: (result: VisionResult) => void;
        analyzeMock.mockImplementation(
            () =>
                new Promise<VisionResult>((resolve) => {
                    resolveAnalysis = resolve;
                }),
        );
        launchCameraMock.mockResolvedValue(cameraAsset());
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await waitFor(() => {
            expect(analyzeMock).toHaveBeenCalled();
        });
        expect(getByText('Reading text...')).toBeTruthy();
        expect(getByText('Running OCR (Hindi + English)')).toBeTruthy();

        // Finish the analysis and land on the done screen.
        resolveAnalysis(visionResult({ raw_text: 'eventually detected' }));
        expect(await findByText('eventually detected')).toBeTruthy();
    });

    test('gives a single short vibration on successful detection', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockResolvedValue(visionResult({ raw_text: 'hello world' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await findByText('hello world');
        expect(vibrateMock).toHaveBeenCalledWith(50);
    });
});

// ─── gallery flow ───────────────────────────────────────────────────────────

describe('PointAndSpeakScreen — gallery flow', () => {
    test('calls launchImageLibrary with the expected options (no saveToPhotos)', async () => {
        launchImageLibraryMock.mockResolvedValue({ assets: [] });
        const { getByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('📁 Or pick from gallery'));

        await waitFor(() => {
            expect(launchImageLibraryMock).toHaveBeenCalledWith({
                mediaType: 'photo',
                quality: 0.5,
                maxWidth: 1024,
                maxHeight: 1024,
            });
        });
        expect(analyzeMock).not.toHaveBeenCalled();
    });

    test('runs OCR on the picked image and shows the result', async () => {
        launchImageLibraryMock.mockResolvedValue(cameraAsset('file:///gallery/menu.jpg'));
        analyzeMock.mockResolvedValue(visionResult({ raw_text: 'Masala Dosa ₹120' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('📁 Or pick from gallery'));

        await waitFor(() => {
            expect(analyzeMock).toHaveBeenCalledWith('file:///gallery/menu.jpg');
        });
        expect(await findByText('Masala Dosa ₹120')).toBeTruthy();
    });
});

// ─── cancellation and picker errors ─────────────────────────────────────────

describe('PointAndSpeakScreen — cancellation and picker errors', () => {
    test('stays idle when the camera returns no assets', async () => {
        launchCameraMock.mockResolvedValue({ assets: [] });
        const { getByText, queryByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await waitFor(() => {
            expect(launchCameraMock).toHaveBeenCalled();
        });
        expect(analyzeMock).not.toHaveBeenCalled();
        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
        expect(queryByText('Reading text...')).toBeNull();
    });

    test('stays idle when the user cancels the camera (didCancel, no assets)', async () => {
        launchCameraMock.mockResolvedValue({ didCancel: true });
        const { getByText, queryByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await waitFor(() => {
            expect(launchCameraMock).toHaveBeenCalled();
        });
        expect(analyzeMock).not.toHaveBeenCalled();
        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
        expect(queryByText('No Text Found')).toBeNull();
    });

    test('stays idle when the gallery picker is cancelled', async () => {
        launchImageLibraryMock.mockResolvedValue({ didCancel: true });
        const { getByText, queryByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('📁 Or pick from gallery'));

        await waitFor(() => {
            expect(launchImageLibraryMock).toHaveBeenCalled();
        });
        expect(analyzeMock).not.toHaveBeenCalled();
        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
        expect(queryByText('Reading text...')).toBeNull();
    });

    test('logs the error and stays idle when the camera throws', async () => {
        launchCameraMock.mockRejectedValue(new Error('camera permission denied'));
        const { getByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
                '[PointAndSpeak] Camera error:',
                expect.any(Error),
            );
        });
        expect(analyzeMock).not.toHaveBeenCalled();
        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
    });

    test('logs the error and stays idle when the gallery picker throws', async () => {
        launchImageLibraryMock.mockRejectedValue(new Error('gallery unavailable'));
        const { getByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('📁 Or pick from gallery'));

        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
                '[PointAndSpeak] Gallery error:',
                expect.any(Error),
            );
        });
        expect(analyzeMock).not.toHaveBeenCalled();
        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
    });
});

// ─── no-text outcomes ───────────────────────────────────────────────────────

describe('PointAndSpeakScreen — no-text outcomes', () => {
    test('shows the no-text UI when OCR detects nothing (EMPTY)', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockResolvedValue(visionResult({ detection_type: 'EMPTY', raw_text: '' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        expect(await findByText('No Text Found')).toBeTruthy();
        expect(
            getByText(
                'Could not detect readable text in this image. Try pointing at a clearer sign, label, or document.',
            ),
        ).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
    });

    test('shows the no-text UI when the detected text is whitespace-only', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockResolvedValue(visionResult({ detection_type: 'TEXT', raw_text: '   \n  ' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        expect(await findByText('No Text Found')).toBeTruthy();
    });

    test('shows the no-text UI and logs when the OCR pipeline rejects', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockRejectedValue(new Error('ocr crashed'));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        expect(await findByText('No Text Found')).toBeTruthy();
        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
                '[PointAndSpeak] Pipeline error:',
                expect.any(Error),
            );
        });
    });

    test('gives a double-buzz vibration when no text is found', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockResolvedValue(visionResult({ detection_type: 'EMPTY', raw_text: '' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));

        await findByText('No Text Found');
        expect(vibrateMock).toHaveBeenCalledWith([0, 100, 50, 100]);
    });
});

// ─── reset and re-scan ──────────────────────────────────────────────────────

describe('PointAndSpeakScreen — reset and re-scan', () => {
    test('"New Scan" returns to the idle screen after a successful scan', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockResolvedValue(visionResult({ raw_text: 'first read' }));
        const { getByText, findByText, queryByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));
        await findByText('first read');

        await fireEvent.press(getByText('New Scan'));

        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
        expect(queryByText('first read')).toBeNull();
    });

    test('"Try Again" returns to the idle screen after a no-text result', async () => {
        launchCameraMock.mockResolvedValue(cameraAsset());
        analyzeMock.mockResolvedValue(visionResult({ detection_type: 'EMPTY', raw_text: '' }));
        const { getByText, findByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));
        await findByText('No Text Found');

        await fireEvent.press(getByText('Try Again'));

        expect(getByText('Tap to Scan & Listen')).toBeTruthy();
        expect(getByText('📁 Or pick from gallery')).toBeTruthy();
    });

    test('can scan again after resetting — new photo is analyzed and shown', async () => {
        launchCameraMock
            .mockResolvedValueOnce(cameraAsset('file:///camera/first.jpg'))
            .mockResolvedValueOnce(cameraAsset('file:///camera/second.jpg'));
        analyzeMock
            .mockResolvedValueOnce(visionResult({ raw_text: 'first text' }))
            .mockResolvedValueOnce(visionResult({ raw_text: 'second text' }));
        const { getByText, findByText, queryByText } = await render(<PointAndSpeakScreen />);

        await fireEvent.press(getByText('Tap to Scan & Listen'));
        await findByText('first text');

        await fireEvent.press(getByText('New Scan'));
        await fireEvent.press(getByText('Tap to Scan & Listen'));

        expect(await findByText('second text')).toBeTruthy();
        expect(queryByText('first text')).toBeNull();
        expect(analyzeMock).toHaveBeenNthCalledWith(1, 'file:///camera/first.jpg');
        expect(analyzeMock).toHaveBeenNthCalledWith(2, 'file:///camera/second.jpg');
    });
});
