/**
 * useVoiceRecording.test.ts
 *
 * Thorough tests for the useVoiceRecording hook — mic recording + on-device
 * STT via NativeModules.SherpaOnnxModule.
 *
 * Testing strategy:
 * - The hook module builds a module-level `NativeEventEmitter`. We capture the
 *   listeners it registers by spying on `NativeEventEmitter.prototype.addListener`
 *   (installed in beforeEach, before renderHook runs the effect) and drive the
 *   native event flow manually with emit().
 * - SherpaOnnxModule is mocked in jest.setup.js as jest.fn methods; controlled
 *   per-test via mockResolvedValue / mockRejectedValue.
 * - PermissionsAndroid / Alert / Vibration are spied per-test.
 * - The hook's 200ms audio-level interval is driven deterministically: we
 *   capture the real callback via a setInterval spy and invoke it manually
 *   while controlling the clock with jest.setSystemTime. (Advancing fake
 *   timers does not reliably fire the hook's interval in this RNTL v14 +
 *   fake-timers environment, so manual invocation tests the actual logic.)
 * - clearInterval is spied to prove the interval is torn down on speech end,
 *   error, and unmount.
 *
 * NOTE: @testing-library/react-native v14 is fully async — renderHook,
 * rerender, unmount and act all return promises and must be awaited.
 */

import {
    Alert,
    NativeEventEmitter,
    NativeModules,
    PermissionsAndroid,
    Platform,
    Vibration,
} from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../../utils/AppLogger', () => ({
    AppLogger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        getRecent: jest.fn(() => []),
        getErrors: jest.fn(() => []),
    },
}));

import { AppLogger } from '../../utils/AppLogger';
import { useVoiceRecording } from '../useVoiceRecording';

const { SherpaOnnxModule } = NativeModules;
const startRecognition = SherpaOnnxModule.startRecognition as jest.Mock;
const stopRecognition = SherpaOnnxModule.stopRecognition as jest.Mock;
const cancelRecognition = SherpaOnnxModule.cancelRecognition as jest.Mock;
const logError = AppLogger.error as jest.Mock;

// ---------------------------------------------------------------------------
// Native event plumbing: capture listeners registered on the module-level
// emitter so tests can drive onSpeechStart/onSpeechEnd/onSpeechResults/
// onSpeechError deterministically.
// ---------------------------------------------------------------------------

type Listener = (...args: any[]) => void;

const listeners: Record<string, Listener[]> = {};
const removals: jest.Mock[] = [];
let addListenerSpy: jest.SpyInstance;
let setIntervalSpy: jest.SpyInstance;
let clearIntervalSpy: jest.SpyInstance;

async function emit(event: string, ...args: any[]): Promise<void> {
    await act(() => {
        for (const listener of [...(listeners[event] ?? [])]) {
            listener(...args);
        }
    });
}

function listenerCount(event: string): number {
    return listeners[event]?.length ?? 0;
}

/** Index of the hook's 200ms audio-level interval in the setInterval spy. */
function hookIntervalIndex(): number {
    const idx = setIntervalSpy.mock.calls.findIndex((c) => c[1] === 200);
    if (idx === -1) {
        throw new Error('hook 200ms interval was not registered');
    }
    return idx;
}

/** The actual callback the hook registered with setInterval(…, 200). */
function hookIntervalCallback(): () => void {
    return setIntervalSpy.mock.calls[hookIntervalIndex()][0] as () => void;
}

/** The timer id the hook stored for its 200ms interval. */
function hookTimerId(): unknown {
    return setIntervalSpy.mock.results[hookIntervalIndex()].value;
}

async function fireHookInterval(): Promise<void> {
    const cb = hookIntervalCallback();
    await act(() => {
        cb();
    });
}

// ---------------------------------------------------------------------------
// Platform.OS helper — the jest env defaults to 'ios'
// ---------------------------------------------------------------------------

const realOS = Platform.OS;

function setOS(os: typeof Platform.OS): void {
    (Platform as { OS: string }).OS = os;
}

beforeEach(() => {
    for (const key of Object.keys(listeners)) {
        delete listeners[key];
    }
    removals.length = 0;
    jest.clearAllMocks();
    jest.useFakeTimers();
    addListenerSpy = jest
        .spyOn(NativeEventEmitter.prototype, 'addListener')
        .mockImplementation(((eventType: string, listener: Listener) => {
            (listeners[eventType] ??= []).push(listener);
            const remove = jest.fn(() => {
                const arr = listeners[eventType];
                if (arr) {
                    const i = arr.indexOf(listener);
                    if (i >= 0) {
                        arr.splice(i, 1);
                    }
                }
            });
            removals.push(remove);
            return { remove };
        }) as unknown as typeof NativeEventEmitter.prototype.addListener);
    setIntervalSpy = jest.spyOn(global, 'setInterval');
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    setOS(realOS);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PermissionResult = 'granted' | 'denied' | 'never_ask_again';

function mockPermission(result: PermissionResult): jest.SpyInstance {
    return jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(result);
}

function mockAlert(): jest.SpyInstance {
    return jest.spyOn(Alert, 'alert').mockImplementation(() => {});
}

function mockVibrate(): jest.SpyInstance {
    return jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
}

// ---------------------------------------------------------------------------
// Initial state & listener wiring
// ---------------------------------------------------------------------------

describe('useVoiceRecording — initial state and event wiring', () => {
    test('returns idle defaults and handler functions', async () => {
        const onTranscription = jest.fn();
        const { result } = await renderHook(() => useVoiceRecording(onTranscription));

        expect(result.current.isRecording).toBe(false);
        expect(result.current.isTranscribing).toBe(false);
        expect(result.current.isModelLoading).toBe(false);
        expect(result.current.audioLevel).toBe(0);
        expect(result.current.recordingDuration).toBe(0);
        expect(typeof result.current.startListening).toBe('function');
        expect(typeof result.current.stopListening).toBe('function');
        expect(typeof result.current.cleanupRecording).toBe('function');
    });

    test('subscribes to the four sherpa events on mount', async () => {
        await renderHook(() => useVoiceRecording(jest.fn()));

        expect(addListenerSpy).toHaveBeenCalledTimes(4);
        const eventTypes = addListenerSpy.mock.calls.map((c) => c[0]).sort();
        expect(eventTypes).toEqual([
            'onSpeechEnd',
            'onSpeechError',
            'onSpeechResults',
            'onSpeechStart',
        ]);
        expect(listenerCount('onSpeechStart')).toBe(1);
        expect(listenerCount('onSpeechEnd')).toBe(1);
        expect(listenerCount('onSpeechResults')).toBe(1);
        expect(listenerCount('onSpeechError')).toBe(1);
    });

    test('removes all four listeners on unmount', async () => {
        const { unmount } = await renderHook(() => useVoiceRecording(jest.fn()));

        expect(removals).toHaveLength(4);
        await unmount();

        for (const remove of removals) {
            expect(remove).toHaveBeenCalledTimes(1);
        }
        expect(listenerCount('onSpeechStart')).toBe(0);
        expect(listenerCount('onSpeechEnd')).toBe(0);
        expect(listenerCount('onSpeechResults')).toBe(0);
        expect(listenerCount('onSpeechError')).toBe(0);
    });

    test('re-subscribes when the onTranscription callback identity changes', async () => {
        const cb1 = jest.fn();
        const cb2 = jest.fn();
        const { rerender } = await renderHook(
            (props: { cb: (text: string) => void }) => useVoiceRecording(props.cb),
            { initialProps: { cb: cb1 } },
        );

        expect(addListenerSpy).toHaveBeenCalledTimes(4);
        const oldRemovals = [...removals];

        await rerender({ cb: cb2 });

        // Old listeners torn down, fresh ones registered (effect dep = [onTranscription])
        expect(addListenerSpy).toHaveBeenCalledTimes(8);
        for (const remove of oldRemovals) {
            expect(remove).toHaveBeenCalledTimes(1);
        }
        expect(listenerCount('onSpeechResults')).toBe(1);

        // The live listener now closes over cb2, not cb1
        await emit('onSpeechResults', { value: ['  hello world  '] });
        expect(cb2).toHaveBeenCalledWith('hello world');
        expect(cb1).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// onSpeechStart — recording begins, interval ticks duration + audio level
// ---------------------------------------------------------------------------

describe('useVoiceRecording — onSpeechStart', () => {
    test('sets isRecording=true and isTranscribing=false', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');

        expect(result.current.isRecording).toBe(true);
        expect(result.current.isTranscribing).toBe(false);
    });

    test('registers a 200ms interval that drives duration and audio level', async () => {
        await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');

        // The hook's simulation interval: setInterval(cb, 200)
        expect(hookIntervalIndex()).toBeGreaterThanOrEqual(0);
        expect(setIntervalSpy.mock.calls[hookIntervalIndex()][1]).toBe(200);
    });

    test('interval callback updates recordingDuration deterministically', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));
        jest.setSystemTime(1_000_000);

        await emit('onSpeechStart');
        expect(result.current.recordingDuration).toBe(0);

        jest.setSystemTime(1_000_200);
        await fireHookInterval();
        expect(result.current.recordingDuration).toBe(200);

        jest.setSystemTime(1_001_200);
        await fireHookInterval();
        expect(result.current.recordingDuration).toBe(1200);
    });

    test('interval callback updates audioLevel from Math.random in [0.3, 0.8)', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');
        await fireHookInterval();

        // 0.3 + 0.5 * 0.5 = 0.55
        expect(result.current.audioLevel).toBeCloseTo(0.55, 5);
    });

    test('repeated speech-start events restart the duration clock', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));
        jest.setSystemTime(10_000);

        await emit('onSpeechStart');
        jest.setSystemTime(15_000);
        await fireHookInterval();
        expect(result.current.recordingDuration).toBe(5000);

        // Second start re-arms recordingStartRef; duration restarts.
        // (Source does not clear the previous interval first — the newest
        // callback wins the state update.)
        jest.setSystemTime(99_000);
        await emit('onSpeechStart');
        const latest = setIntervalSpy.mock.calls
            .map((c, i) => ({ c, i }))
            .filter(({ c }) => c[1] === 200)
            .pop();
        expect(latest).toBeDefined();
        jest.setSystemTime(99_400);
        await act(() => {
            (latest!.c[0] as () => void)();
        });
        expect(result.current.recordingDuration).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// onSpeechEnd — recording stops, transcription begins
// ---------------------------------------------------------------------------

describe('useVoiceRecording — onSpeechEnd', () => {
    test('flips to transcribing state and zeroes the audio level', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');
        expect(result.current.isRecording).toBe(true);

        await emit('onSpeechEnd');

        expect(result.current.isRecording).toBe(false);
        expect(result.current.isTranscribing).toBe(true);
        expect(result.current.audioLevel).toBe(0);
    });

    test('clears the duration interval so the clock cannot tick further', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));
        jest.setSystemTime(7_000);

        await emit('onSpeechStart');
        const timerId = hookTimerId();
        jest.setSystemTime(7_800);
        await fireHookInterval();
        expect(result.current.recordingDuration).toBe(800);

        await emit('onSpeechEnd');

        expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
        // The cleared interval is gone: no new 200ms interval was registered.
        const intervals = setIntervalSpy.mock.calls.filter((c) => c[1] === 200);
        expect(intervals).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// onSpeechResults — transcription delivery
// ---------------------------------------------------------------------------

describe('useVoiceRecording — onSpeechResults', () => {
    test('ends transcribing state and delivers trimmed text', async () => {
        const onTranscription = jest.fn();
        const { result } = await renderHook(() => useVoiceRecording(onTranscription));

        await emit('onSpeechEnd');
        expect(result.current.isTranscribing).toBe(true);

        await emit('onSpeechResults', { value: ['  namaste duniya  '] });

        expect(result.current.isTranscribing).toBe(false);
        expect(onTranscription).toHaveBeenCalledTimes(1);
        expect(onTranscription).toHaveBeenCalledWith('namaste duniya');
    });

    test('ignores empty-string results', async () => {
        const onTranscription = jest.fn();
        const { result } = await renderHook(() => useVoiceRecording(onTranscription));

        await emit('onSpeechResults', { value: [''] });

        expect(onTranscription).not.toHaveBeenCalled();
        expect(result.current.isTranscribing).toBe(false);
    });

    test('ignores whitespace-only results', async () => {
        const onTranscription = jest.fn();
        await renderHook(() => useVoiceRecording(onTranscription));

        await emit('onSpeechResults', { value: ['   \n\t  '] });

        expect(onTranscription).not.toHaveBeenCalled();
    });

    test.each([
        ['undefined event', undefined],
        ['null event', null],
        ['empty object', {}],
        ['missing value', { value: undefined }],
        ['empty value array', { value: [] }],
        ['null first entry', { value: [null] }],
    ])('handles malformed payload without throwing: %s', async (_label, payload) => {
        const onTranscription = jest.fn();
        const { result } = await renderHook(() => useVoiceRecording(onTranscription));

        await emit('onSpeechResults', payload);
        expect(onTranscription).not.toHaveBeenCalled();
        expect(result.current.isTranscribing).toBe(false);
    });

    test('delivers only the first value entry', async () => {
        const onTranscription = jest.fn();
        await renderHook(() => useVoiceRecording(onTranscription));

        await emit('onSpeechResults', { value: ['first', 'second'] });

        expect(onTranscription).toHaveBeenCalledTimes(1);
        expect(onTranscription).toHaveBeenCalledWith('first');
    });
});

// ---------------------------------------------------------------------------
// onSpeechError — failure resets state and logs
// ---------------------------------------------------------------------------

describe('useVoiceRecording — onSpeechError', () => {
    test('resets recording state, clears the interval, and logs the error', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');
        const timerId = hookTimerId();

        const err = new Error('mic failed');
        await emit('onSpeechError', err);

        expect(result.current.isRecording).toBe(false);
        expect(result.current.isTranscribing).toBe(false);
        expect(result.current.audioLevel).toBe(0);
        expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
        expect(logError).toHaveBeenCalledWith(
            'VoiceRecording',
            'Speech recognition error',
            err,
        );
    });

    test('error before any start is a safe no-op state-wise', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechError', { message: 'early' });
        expect(result.current.isRecording).toBe(false);
        expect(result.current.isTranscribing).toBe(false);
        expect(logError).toHaveBeenCalledTimes(1);
        // No interval ever existed, so nothing was cleared.
        expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// startListening
// ---------------------------------------------------------------------------

describe('useVoiceRecording — startListening', () => {
    test('android + granted permission: vibrates, then starts recognition', async () => {
        setOS('android');
        const requestSpy = mockPermission(PermissionsAndroid.RESULTS.GRANTED);
        const vibrateSpy = mockVibrate();
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });

        expect(requestSpy).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        expect(startRecognition).toHaveBeenCalledTimes(1);
        // Haptic feedback fires before the permission prompt
        expect(vibrateSpy.mock.invocationCallOrder[0]).toBeLessThan(
            requestSpy.mock.invocationCallOrder[0],
        );
        expect(requestSpy.mock.invocationCallOrder[0]).toBeLessThan(
            startRecognition.mock.invocationCallOrder[0],
        );
        expect(vibrateSpy).toHaveBeenCalledWith(40);
    });

    test('android + denied permission: alerts and never starts recognition', async () => {
        setOS('android');
        mockPermission(PermissionsAndroid.RESULTS.DENIED);
        const alertSpy = mockAlert();
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'Permission Denied',
            'Microphone permission is required for voice search.',
        );
        expect(startRecognition).not.toHaveBeenCalled();
        expect(result.current.isRecording).toBe(false);
    });

    test('android + never-ask-again is treated as denied', async () => {
        setOS('android');
        mockPermission(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
        const alertSpy = mockAlert();
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });

        expect(alertSpy).toHaveBeenCalledWith('Permission Denied', expect.any(String));
        expect(startRecognition).not.toHaveBeenCalled();
    });

    test('ios skips the permission request entirely', async () => {
        setOS('ios');
        const requestSpy = mockPermission(PermissionsAndroid.RESULTS.GRANTED);
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });

        expect(requestSpy).not.toHaveBeenCalled();
        expect(startRecognition).toHaveBeenCalledTimes(1);
    });

    test('startRecognition rejection: logs, error vibration pattern, and alert', async () => {
        setOS('android');
        mockPermission(PermissionsAndroid.RESULTS.GRANTED);
        const failure = new Error('native crash');
        startRecognition.mockRejectedValueOnce(failure);
        const vibrateSpy = mockVibrate();
        const alertSpy = mockAlert();
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });

        expect(logError).toHaveBeenCalledWith('VoiceRecording', 'Start failed', failure);
        expect(vibrateSpy).toHaveBeenCalledWith([0, 30, 50, 30]);
        expect(alertSpy).toHaveBeenCalledWith(
            'Voice Error',
            'Could not start voice recognition. Please try again.',
        );
        expect(result.current.isRecording).toBe(false);
    });

    test('permission request rejection follows the same error path', async () => {
        setOS('android');
        const requestFailure = new Error('permission bridge down');
        jest.spyOn(PermissionsAndroid, 'request').mockRejectedValueOnce(requestFailure);
        const alertSpy = mockAlert();
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });

        expect(logError).toHaveBeenCalledWith('VoiceRecording', 'Start failed', requestFailure);
        expect(alertSpy).toHaveBeenCalledWith('Voice Error', expect.any(String));
        expect(startRecognition).not.toHaveBeenCalled();
    });

    test('double start calls startRecognition twice (no guard in source)', async () => {
        setOS('android');
        mockPermission(PermissionsAndroid.RESULTS.GRANTED);
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.startListening();
        });
        await act(async () => {
            await result.current.startListening();
        });

        // Documents actual behavior: the hook does not debounce concurrent starts.
        expect(startRecognition).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// stopListening
// ---------------------------------------------------------------------------

describe('useVoiceRecording — stopListening', () => {
    test('stops recognition and resets recording UI state', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');
        // Simulate a mid-recording audio level via the interval callback.
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
        await fireHookInterval();
        expect(result.current.isRecording).toBe(true);
        expect(result.current.audioLevel).toBeCloseTo(0.55, 5);

        await act(async () => {
            await result.current.stopListening();
        });

        expect(stopRecognition).toHaveBeenCalledTimes(1);
        expect(result.current.isRecording).toBe(false);
        expect(result.current.audioLevel).toBe(0);
    });

    test('stop without a prior start still calls the native module without throwing', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.stopListening();
        });

        expect(stopRecognition).toHaveBeenCalledTimes(1);
        expect(result.current.isRecording).toBe(false);
    });

    test('stopRecognition rejection is logged, not thrown', async () => {
        const failure = new Error('stop failed');
        stopRecognition.mockRejectedValueOnce(failure);
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(async () => {
            await result.current.stopListening();
        });

        expect(logError).toHaveBeenCalledWith('VoiceRecording', 'Stop failed', failure);
    });
});

// ---------------------------------------------------------------------------
// cleanupRecording
// ---------------------------------------------------------------------------

describe('useVoiceRecording — cleanupRecording', () => {
    test('cancels the native recognition session', async () => {
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(() => {
            result.current.cleanupRecording();
        });

        expect(cancelRecognition).toHaveBeenCalledTimes(1);
    });

    test('a rejected cancel is swallowed (no unhandled rejection)', async () => {
        cancelRecognition.mockRejectedValueOnce(new Error('already gone'));
        const { result } = await renderHook(() => useVoiceRecording(jest.fn()));

        await act(() => {
            result.current.cleanupRecording();
        });

        // Flush microtasks — the .catch(() => {}) attached in source handles it.
        await act(async () => {});
        expect(cancelRecognition).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Unmount safety
// ---------------------------------------------------------------------------

describe('useVoiceRecording — unmount safety', () => {
    test('unmount during recording clears the audio-level interval', async () => {
        const { unmount } = await renderHook(() => useVoiceRecording(jest.fn()));

        await emit('onSpeechStart');
        const timerId = hookTimerId();

        await unmount();

        expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
    });

    test('unmount while idle leaves listeners removed and no interval behind', async () => {
        const { unmount } = await renderHook(() => useVoiceRecording(jest.fn()));

        await unmount();

        expect(removals).toHaveLength(4);
        // No interval was ever created, so clearInterval was never needed.
        expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
});
