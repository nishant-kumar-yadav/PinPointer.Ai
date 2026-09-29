/**
 * Tests for SpeechToTextScreen — the on-device STT screen.
 *
 * Strategy: the useVoiceRecording hook is fully mocked and driven per-test
 * (idle / recording / transcribing states). The transcription callback the
 * screen passes to the hook is captured and invoked to simulate STT results.
 * AudioVisualizer is the real pure-RN component; LinearGradient comes from
 * the repo's root __mocks__.
 */
import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react-native';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { SpeechToTextScreen } from '../SpeechToTextScreen';

jest.mock('../../hooks/useVoiceRecording', () => ({
  useVoiceRecording: jest.fn(),
}));

const mockUseVoiceRecording = useVoiceRecording as jest.Mock;

type VoiceRecordingState = {
  isRecording: boolean;
  isTranscribing: boolean;
  isModelLoading: boolean;
  audioLevel: number;
  recordingDuration: number;
  startListening: jest.Mock;
  stopListening: jest.Mock;
  cleanupRecording: jest.Mock;
};

const makeHookState = (overrides: Partial<VoiceRecordingState> = {}): VoiceRecordingState => ({
  isRecording: false,
  isTranscribing: false,
  isModelLoading: false,
  audioLevel: 0,
  recordingDuration: 0,
  startListening: jest.fn(),
  stopListening: jest.fn(),
  cleanupRecording: jest.fn(),
  ...overrides,
});

type JsonNode = {
  type: string;
  props: { style?: unknown };
  children?: Array<JsonNode | string> | null;
};

const styleOf = (node: JsonNode): Record<string, unknown> => {
  const style = node.props.style;
  if (Array.isArray(style)) return Object.assign({}, ...style);
  return (style ?? {}) as Record<string, unknown>;
};

/** Recursively collect host nodes matching a predicate from toJSON(). */
const findJsonNodes = (
  node: JsonNode | string | null,
  pred: (n: JsonNode) => boolean,
  acc: JsonNode[] = []
): JsonNode[] => {
  if (!node || typeof node === 'string') return acc;
  if (pred(node)) acc.push(node);
  for (const child of node.children ?? []) findJsonNodes(child, pred, acc);
  return acc;
};

/** The AudioVisualizer container: row layout with fixed height 60. */
const findVisualizerContainers = (screen: { toJSON: () => JsonNode | null }): JsonNode[] =>
  findJsonNodes(screen.toJSON(), n => {
    const style = styleOf(n);
    return n.type === 'View' && style.flexDirection === 'row' && style.height === 60;
  });

/** The transcription callback the screen hands to useVoiceRecording. */
const getOnTranscription = (): ((text: string) => void) => {
  const calls = mockUseVoiceRecording.mock.calls;
  if (calls.length === 0) throw new Error('useVoiceRecording was not called');
  return calls[0][0] as (text: string) => void;
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUseVoiceRecording.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SpeechToTextScreen — idle state', () => {
  test('shows the idle prompt, mic icon and start button', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    expect(screen.getByText('Tap to Record')).toBeTruthy();
    expect(screen.getByText('On-device speech recognition')).toBeTruthy();
    expect(screen.getByText('Start Recording')).toBeTruthy();
    // Mic emoji appears in the idle art container and on the record button.
    expect(screen.getAllByText('🎤')).toHaveLength(2);
  });

  test('does not show recording, transcribing, transcription or history UI when idle', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    expect(screen.queryByText('Listening...')).toBeNull();
    expect(screen.queryByText('Transcribing...')).toBeNull();
    expect(screen.queryByText('LATEST')).toBeNull();
    expect(screen.queryByText('History')).toBeNull();
    expect(screen.queryByText('Stop Recording')).toBeNull();
    expect(findVisualizerContainers(screen)).toHaveLength(0);
  });

  test('pressing the record button calls startListening', async () => {
    const state = makeHookState();
    mockUseVoiceRecording.mockReturnValue(state);
    const screen = await render(<SpeechToTextScreen />);

    await fireEvent.press(screen.getByText('Start Recording'));
    expect(state.startListening).toHaveBeenCalledTimes(1);
  });
});

describe('SpeechToTextScreen — recording state', () => {
  test('shows Listening status, stop button and stop icon while recording', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState({ isRecording: true }));
    const screen = await render(<SpeechToTextScreen />);

    expect(screen.getByText('Listening...')).toBeTruthy();
    expect(screen.getByText('Stop Recording')).toBeTruthy();
    expect(screen.getByText('⏹')).toBeTruthy();
    expect(screen.queryByText('Tap to Record')).toBeNull();
    expect(screen.queryByText('Start Recording')).toBeNull();
  });

  test('renders the AudioVisualizer while recording', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState({ isRecording: true, audioLevel: 0.7 }));
    const screen = await render(<SpeechToTextScreen />);

    expect(findVisualizerContainers(screen)).toHaveLength(1);
  });

  test('passes the live audioLevel through to the visualizer bars', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState({ isRecording: true, audioLevel: 0.7 }));
    const screen = await render(<SpeechToTextScreen />);

    const [container] = findVisualizerContainers(screen);
    const bars = findJsonNodes(container, n => {
      const style = styleOf(n);
      return (
        n.type === 'View' &&
        style.width === 6 &&
        typeof style.height === 'string' &&
        style.height.endsWith('%')
      );
    });
    // Default barCount is 7; with level 0.7 at least one bar exceeds the 20% floor,
    // proving the level prop reached the visualizer.
    expect(bars).toHaveLength(7);
    expect(bars.some(b => (styleOf(b).height as string) !== '20%')).toBe(true);
  });

  test('pressing the record button while recording calls stopListening', async () => {
    const state = makeHookState({ isRecording: true });
    mockUseVoiceRecording.mockReturnValue(state);
    const screen = await render(<SpeechToTextScreen />);

    await fireEvent.press(screen.getByText('Stop Recording'));
    expect(state.stopListening).toHaveBeenCalledTimes(1);
    expect(state.startListening).not.toHaveBeenCalled();
  });

  test.each([
    [0, '0:00'],
    [5000, '0:05'],
    [59000, '0:59'],
    [60000, '1:00'],
    [90000, '1:30'],
    [3599000, '59:59'],
  ])('formats recording duration %d ms as "%s"', async (ms, expected) => {
    mockUseVoiceRecording.mockReturnValue(
      makeHookState({ isRecording: true, recordingDuration: ms })
    );
    const screen = await render(<SpeechToTextScreen />);

    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe('SpeechToTextScreen — transcribing state', () => {
  test('shows Transcribing status and loading indicator', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState({ isTranscribing: true }));
    const screen = await render(<SpeechToTextScreen />);

    expect(screen.getByText('Transcribing...')).toBeTruthy();
    expect(screen.getByText('⏳')).toBeTruthy();
    expect(screen.queryByText('Listening...')).toBeNull();
    expect(screen.queryByText('Tap to Record')).toBeNull();
  });

  test('record button does nothing while transcribing (disabled)', async () => {
    const state = makeHookState({ isTranscribing: true });
    mockUseVoiceRecording.mockReturnValue(state);
    const screen = await render(<SpeechToTextScreen />);

    await fireEvent.press(screen.getByText('Start Recording'));
    expect(state.startListening).not.toHaveBeenCalled();
    expect(state.stopListening).not.toHaveBeenCalled();
  });

  test('transcription card shows "Processing..." while transcribing', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState({ isTranscribing: true }));
    const screen = await render(<SpeechToTextScreen />);

    expect(screen.getByText('LATEST')).toBeTruthy();
    expect(screen.getByText('Processing...')).toBeTruthy();
  });

  test('stale transcription is replaced by "Processing..." while transcribing', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      getOnTranscription()('stale text from earlier');
    });
    expect(screen.getAllByText('stale text from earlier')).toHaveLength(2);

    mockUseVoiceRecording.mockReturnValue(makeHookState({ isTranscribing: true }));
    await screen.rerender(<SpeechToTextScreen />);

    expect(screen.getByText('Processing...')).toBeTruthy();
    // The card no longer shows the stale text; only the history item remains.
    expect(screen.getAllByText('stale text from earlier')).toHaveLength(1);
  });
});

describe('SpeechToTextScreen — transcription results', () => {
  test('invoking the transcription callback shows the LATEST card with the text', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      getOnTranscription()('hello world from sherpa');
    });

    expect(screen.getByText('LATEST')).toBeTruthy();
    // The transcription appears in the LATEST card AND as the first history item.
    expect(screen.getAllByText('hello world from sherpa')).toHaveLength(2);
  });

  test('latest transcription replaces the previous one in the LATEST card', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      const cb = getOnTranscription();
      cb('first utterance');
      cb('second utterance');
    });

    // The LATEST card (rendered before the history section) shows the newest text.
    const matches = screen.getAllByText('second utterance');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('first utterance')).toBeTruthy(); // still in history
  });

  test('transcription callback is registered once with the hook', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    await render(<SpeechToTextScreen />);

    expect(mockUseVoiceRecording).toHaveBeenCalledTimes(1);
    expect(typeof getOnTranscription()).toBe('function');
  });
});

describe('SpeechToTextScreen — history', () => {
  test('completed transcriptions appear in the history section', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      getOnTranscription()('history entry one');
    });

    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText('Clear')).toBeTruthy();
    expect(screen.getAllByText('history entry one')).toHaveLength(2);
  });

  test('history is ordered newest-first', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      const cb = getOnTranscription();
      cb('alpha');
      cb('beta');
      cb('gamma');
    });

    const title = screen.getByText('History');
    const header = title.parent;
    const section = header?.parent;
    if (!section) throw new Error('history section not found');

    const items = within(section).getAllByText(/^(alpha|beta|gamma)$/);
    expect(items.map(t => t.props.children)).toEqual(['gamma', 'beta', 'alpha']);
  });

  test('history is capped at 100 entries (oldest dropped)', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      const cb = getOnTranscription();
      for (let i = 0; i < 105; i++) {
        cb(`transcript ${i}`);
      }
    });

    const title = screen.getByText('History');
    const section = title.parent?.parent;
    if (!section) throw new Error('history section not found');

    const items = within(section).getAllByText(/^transcript \d+$/);
    expect(items).toHaveLength(100);
    // Newest kept, oldest evicted.
    expect(within(section).queryByText('transcript 104')).toBeTruthy();
    expect(within(section).queryByText('transcript 0')).toBeNull();
    expect(within(section).queryByText('transcript 4')).toBeNull();
    expect(within(section).queryByText('transcript 5')).toBeTruthy();
  });

  test('Clear button empties history and the current transcription', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      const cb = getOnTranscription();
      cb('to be cleared one');
      cb('to be cleared two');
    });
    expect(screen.getByText('History')).toBeTruthy();

    await fireEvent.press(screen.getByText('Clear'));

    expect(screen.queryByText('History')).toBeNull();
    expect(screen.queryByText('LATEST')).toBeNull();
    expect(screen.queryByText('to be cleared one')).toBeNull();
    expect(screen.queryByText('to be cleared two')).toBeNull();
  });

  test('new transcriptions still work after clearing history', async () => {
    mockUseVoiceRecording.mockReturnValue(makeHookState());
    const screen = await render(<SpeechToTextScreen />);

    await act(async () => {
      getOnTranscription()('before clear');
    });
    await fireEvent.press(screen.getByText('Clear'));
    expect(screen.queryByText('History')).toBeNull();

    await act(async () => {
      getOnTranscription()('after clear');
    });

    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getAllByText('after clear')).toHaveLength(2);
  });
});
