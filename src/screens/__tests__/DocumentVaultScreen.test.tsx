/**
 * Component tests for DocumentVaultScreen (src/screens/DocumentVaultScreen.tsx).
 *
 * Strategy:
 *  - '../../database' is mocked (getAllDocuments: jest.fn()) so the vault is
 *    driven by fixed fixtures instead of the real DB.
 *  - '../../utils/DocumentClassifier' is mocked (classifyDocument: jest.fn())
 *    with a per-test content→category map, making grouping, sectioning and
 *    sorting fully deterministic.
 *  - '@react-navigation/native' useFocusEffect is mocked with a captured
 *    callback, so refocus reloads can be triggered explicitly.
 *  - StorageModule.openPDF comes from the repo's jest.setup.js stub;
 *    Linking.openURL is a cast of the RN preset mock.
 *  - Category cards / document rows / back button are pressed by their label
 *    text; RNTL v14's fireEvent walks up the tree to the nearest press
 *    handler, so pressing a nested label triggers the enclosing
 *    TouchableOpacity's onPress.
 *
 * RNTL v14: render / fireEvent / act are async and awaited.
 */
import React from 'react';
import {
  Linking,
  NativeModules,
} from 'react-native';
import {
  act,
  fireEvent,
  render,
  RenderResult,
} from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import { DocumentVaultScreen } from '../DocumentVaultScreen';
import { getAllDocuments } from '../../database';
import { classifyDocument } from '../../utils/DocumentClassifier';
import type {
  ClassificationResult,
  DocumentCategory,
} from '../../utils/DocumentClassifier';
import type { DocumentRecord } from '../../database';

jest.mock('../../database', () => ({
  getAllDocuments: jest.fn(),
}));

jest.mock('../../utils/DocumentClassifier', () => ({
  classifyDocument: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// ─── Mock handles ───────────────────────────────────────────────────────────

const getAllDocumentsMock = getAllDocuments as jest.Mock;
const classifyMock = classifyDocument as jest.Mock;
const useFocusEffectMock = useFocusEffect as jest.Mock;
const openURLMock = Linking.openURL as jest.Mock;
const storageModule = NativeModules.StorageModule as { openPDF?: jest.Mock };

let capturedFocusCallback: (() => void) | undefined;

// Default classification: consult the per-test map, else GENERAL_DOCUMENT.
(classifyDocument as jest.Mock).mockImplementation(
  (content: string): ClassificationResult =>
    classificationByContent.get(content) ??
    asCategory('GENERAL_DOCUMENT', 'General Document', '📁', 50),
);

// ─── Fixtures ───────────────────────────────────────────────────────────────

let docSeq = 0;

const makeDoc = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => {
  docSeq += 1;
  return {
    id: docSeq,
    title: `Doc ${docSeq}`,
    content: `content-${docSeq}`,
    filePath: `/docs/doc-${docSeq}.pdf`,
    type: 'DOCUMENT',
    detection_type: 'TEXT',
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
};

const asCategory = (
  category: DocumentCategory,
  label: string,
  emoji = '📄',
  confidence = 90,
): ClassificationResult => ({ category, emoji, label, confidence });

// Content string → classification, consulted by the default mock implementation.
const classificationByContent = new Map<string, ClassificationResult>();

const setClassification = (content: string, result: ClassificationResult) => {
  classificationByContent.set(content, result);
};

type NavProp = React.ComponentProps<typeof DocumentVaultScreen>['navigation'];

const makeNavigation = () => ({
  goBack: jest.fn(),
  navigate: jest.fn(),
});

const renderScreen = async (navigation = makeNavigation()) => {
  const screen = await render(
    <DocumentVaultScreen navigation={navigation as unknown as NavProp} />,
  );
  // Run the captured focus-effect callback explicitly, the way real
  // navigation would after the screen gains focus.
  await act(async () => {
    capturedFocusCallback?.();
  });
  return { screen, navigation };
};

// ─── Press helpers ──────────────────────────────────────────────────────────

/**
 * Press the element showing `text`. RNTL v14's fireEvent walks up the tree
 * to the nearest press handler, so pressing a nested label triggers the
 * enclosing TouchableOpacity's onPress.
 */
const pressText = async (screen: RenderResult, text: string) => {
  await fireEvent.press(screen.getByText(text));
};

/** All non-empty text leaves of the rendered host tree, in document order. */
const textOrder = (screen: RenderResult): string[] => {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      const t = node.trim();
      if (t) out.push(t);
      return;
    }
    if (typeof node === 'number') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node !== null && typeof node === 'object' && 'children' in node) {
      walk((node as { children?: unknown }).children);
    }
  };
  walk(screen.toJSON());
  return out;
};

/** Position of a label's text in document order (-1 when absent). */
const indexOfText = (screen: RenderResult, label: string): number =>
  textOrder(screen).indexOf(label);

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('DocumentVaultScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    docSeq = 0;
    classificationByContent.clear();
    capturedFocusCallback = undefined;

    getAllDocumentsMock.mockReset();
    getAllDocumentsMock.mockReturnValue([]);
    classifyMock.mockClear();
    openURLMock.mockClear();
    useFocusEffectMock.mockReset();
    // Store-only: the real useFocusEffect runs its callback in an effect
    // (after commit). Invoking it here during render would setState mid-render
    // and loop forever, so renderScreen() runs it inside act() instead.
    useFocusEffectMock.mockImplementation((cb: () => void) => {
      capturedFocusCallback = cb;
    });
    if (storageModule.openPDF) {
      storageModule.openPDF.mockClear();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Header & navigation ──────────────────────────────────────────────

  test('renders the header title and subtitle', async () => {
    const { screen } = await renderScreen();
    expect(screen.getByText('Document Vault')).toBeTruthy();
    expect(screen.getByText('AI-classified by Pinpointer')).toBeTruthy();
  });

  test('back button calls navigation.goBack', async () => {
    const { screen, navigation } = await renderScreen();
    await pressText(screen, '←');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  // ── Data loading ─────────────────────────────────────────────────────

  test('calls getAllDocuments once when the screen gains focus', async () => {
    await renderScreen();
    expect(getAllDocumentsMock).toHaveBeenCalledTimes(1);
  });

  test('passes each document content and filename to classifyDocument', async () => {
    const doc = makeDoc({ content: 'aadhaar-content', filePath: '/docs/my-aadhaar.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('aadhaar-content', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    await renderScreen();

    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(classifyMock).toHaveBeenCalledWith('aadhaar-content', 'my-aadhaar.pdf');
  });

  test('classifies empty content as an empty string with the filename', async () => {
    const doc = makeDoc({ content: '', filePath: '/docs/empty.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);

    await renderScreen();

    expect(classifyMock).toHaveBeenCalledWith('', 'empty.pdf');
  });

  // ── Empty state ──────────────────────────────────────────────────────

  test('shows the empty state and zero stats when no documents are indexed', async () => {
    const { screen } = await renderScreen();

    expect(screen.getByText('No documents indexed yet')).toBeTruthy();
    expect(screen.getByText('📂')).toBeTruthy();
    expect(
      screen.getByText('Run "Scan Docs" from the Pinpointer dashboard to discover and classify all PDFs on your device.'),
    ).toBeTruthy();
    // All three stats (Documents / Categories / ID Cards) read 0.
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.queryByText('Identity Documents')).toBeNull();
    expect(screen.queryByText('Financial Documents')).toBeNull();
    expect(screen.queryByText('Other Documents')).toBeNull();
  });

  // ── Grouping & sections ──────────────────────────────────────────────

  test('renders identity, financial and other sections for mixed documents', async () => {
    const aadhaar = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a.pdf' });
    const invoice = makeDoc({ content: 'c-invoice', filePath: '/docs/i.pdf' });
    const marksheet = makeDoc({ content: 'c-marksheet', filePath: '/docs/m.pdf' });
    getAllDocumentsMock.mockReturnValue([aadhaar, invoice, marksheet]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));
    setClassification('c-invoice', asCategory('INVOICE', 'Invoice', '🧾', 88));
    setClassification('c-marksheet', asCategory('MARKSHEET', 'Marksheet', '🎓', 92));

    const { screen } = await renderScreen();

    expect(screen.getByText('Identity Documents')).toBeTruthy();
    expect(screen.getByText('Financial Documents')).toBeTruthy();
    expect(screen.getByText('Other Documents')).toBeTruthy();
    expect(screen.getByText('Aadhaar Card')).toBeTruthy();
    expect(screen.getByText('Invoice')).toBeTruthy();
    expect(screen.getByText('Marksheet')).toBeTruthy();
  });

  test('omits the financial section when there are no financial documents', async () => {
    const aadhaar = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a.pdf' });
    getAllDocumentsMock.mockReturnValue([aadhaar]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    expect(screen.getByText('Identity Documents')).toBeTruthy();
    expect(screen.queryByText('Financial Documents')).toBeNull();
    expect(screen.queryByText('Other Documents')).toBeNull();
  });

  test('groups same-category documents into a single card with a plural count', async () => {
    const d1 = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a1.pdf' });
    const d2 = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a2.pdf' });
    getAllDocumentsMock.mockReturnValue([d1, d2]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    expect(screen.getAllByText('Aadhaar Card')).toHaveLength(1);
    expect(screen.getByText('2 documents')).toBeTruthy();
  });

  test('uses the singular "1 document" count for single-document categories', async () => {
    const doc = makeDoc({ content: 'c-pan', filePath: '/docs/p.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-pan', asCategory('PAN_CARD', 'PAN Card', '💳', 93));

    const { screen } = await renderScreen();

    expect(screen.getByText('1 document')).toBeTruthy();
  });

  test('sorts category groups by document count, most documents first', async () => {
    const a1 = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a1.pdf' });
    const a2 = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a2.pdf' });
    const p1 = makeDoc({ content: 'c-pan', filePath: '/docs/p1.pdf' });
    getAllDocumentsMock.mockReturnValue([p1, a1, a2]); // pan inserted first
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));
    setClassification('c-pan', asCategory('PAN_CARD', 'PAN Card', '💳', 93));

    const { screen } = await renderScreen();

    expect(indexOfText(screen, 'Aadhaar Card')).toBeGreaterThanOrEqual(0);
    expect(indexOfText(screen, 'Aadhaar Card')).toBeLessThan(indexOfText(screen, 'PAN Card'));
  });

  test('sorts GENERAL_DOCUMENT last within the Other section', async () => {
    const general = makeDoc({ content: 'c-general', filePath: '/docs/g.pdf' });
    const marksheet = makeDoc({ content: 'c-marksheet', filePath: '/docs/m.pdf' });
    getAllDocumentsMock.mockReturnValue([general, marksheet]); // general inserted first
    setClassification('c-general', asCategory('GENERAL_DOCUMENT', 'General Document', '📁', 50));
    setClassification('c-marksheet', asCategory('MARKSHEET', 'Marksheet', '🎓', 92));

    const { screen } = await renderScreen();

    expect(screen.getByText('Other Documents')).toBeTruthy();
    expect(indexOfText(screen, 'Marksheet')).toBeLessThan(indexOfText(screen, 'General Document'));
  });

  // ── Stats bar ────────────────────────────────────────────────────────

  test('stats bar shows labels and the total document count', async () => {
    const docs = [
      makeDoc({ content: 'c-aadhaar', filePath: '/docs/a1.pdf' }),
      makeDoc({ content: 'c-aadhaar', filePath: '/docs/a2.pdf' }),
      makeDoc({ content: 'c-pan', filePath: '/docs/p1.pdf' }),
      makeDoc({ content: 'c-invoice', filePath: '/docs/i1.pdf' }),
    ];
    getAllDocumentsMock.mockReturnValue(docs);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));
    setClassification('c-pan', asCategory('PAN_CARD', 'PAN Card', '💳', 93));
    setClassification('c-invoice', asCategory('INVOICE', 'Invoice', '🧾', 88));

    const { screen } = await renderScreen();

    expect(screen.getByText('Documents')).toBeTruthy();
    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('ID Cards')).toBeTruthy();
    // 4 docs total; per-group badges are 2/1/1 and section counts are 3/1,
    // so the bare '4' only appears in the stats bar.
    expect(screen.getByText('4')).toBeTruthy();
  });

  // ── Expand / collapse ────────────────────────────────────────────────

  test('tapping a category card expands it to reveal its documents', async () => {
    const doc = makeDoc({ title: 'My Aadhaar', content: 'c-aadhaar', filePath: '/docs/aadhaar.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    expect(screen.queryByText('My Aadhaar')).toBeNull();
    await pressText(screen, 'Aadhaar Card');
    expect(screen.getByText('My Aadhaar')).toBeTruthy();
    expect(screen.getByText('aadhaar.pdf')).toBeTruthy();
  });

  test('tapping an expanded category card collapses it again', async () => {
    const doc = makeDoc({ title: 'My Aadhaar', content: 'c-aadhaar', filePath: '/docs/aadhaar.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    await pressText(screen, 'Aadhaar Card');
    expect(screen.getByText('My Aadhaar')).toBeTruthy();
    await pressText(screen, 'Aadhaar Card');
    expect(screen.queryByText('My Aadhaar')).toBeNull();
  });

  test('expanding one category does not expand the others', async () => {
    const a = makeDoc({ title: 'Aadhaar Doc', content: 'c-aadhaar', filePath: '/docs/a.pdf' });
    const p = makeDoc({ title: 'PAN Doc', content: 'c-pan', filePath: '/docs/p.pdf' });
    getAllDocumentsMock.mockReturnValue([a, p]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));
    setClassification('c-pan', asCategory('PAN_CARD', 'PAN Card', '💳', 93));

    const { screen } = await renderScreen();

    await pressText(screen, 'Aadhaar Card');
    expect(screen.getByText('Aadhaar Doc')).toBeTruthy();
    expect(screen.queryByText('PAN Doc')).toBeNull();
  });

  test('shows "Untitled" for documents without a title', async () => {
    const doc = makeDoc({ title: undefined, content: 'c-aadhaar', filePath: '/docs/notitled.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    await pressText(screen, 'Aadhaar Card');
    expect(screen.getByText('Untitled')).toBeTruthy();
    expect(screen.getByText('notitled.pdf')).toBeTruthy();
  });

  // ── Opening documents ────────────────────────────────────────────────

  test('tapping a document opens it via StorageModule with file:// stripped', async () => {
    const doc = makeDoc({
      title: 'My Aadhaar',
      content: 'c-aadhaar',
      filePath: 'file:///docs/aadhaar.pdf',
    });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    await pressText(screen, 'Aadhaar Card');
    await pressText(screen, 'My Aadhaar');

    expect(storageModule.openPDF).toHaveBeenCalledTimes(1);
    expect(storageModule.openPDF).toHaveBeenCalledWith('/docs/aadhaar.pdf');
    expect(openURLMock).not.toHaveBeenCalled();
  });

  test('passes plain paths to StorageModule.openPDF unchanged', async () => {
    const doc = makeDoc({
      title: 'Plain Path',
      content: 'c-aadhaar',
      filePath: '/docs/plain.pdf',
    });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    await pressText(screen, 'Aadhaar Card');
    await pressText(screen, 'Plain Path');

    expect(storageModule.openPDF).toHaveBeenCalledWith('/docs/plain.pdf');
  });

  test('falls back to Linking.openURL when StorageModule.openPDF is unavailable', async () => {
    const original = storageModule.openPDF;
    storageModule.openPDF = undefined;
    try {
      const doc = makeDoc({
        title: 'Fallback Doc',
        content: 'c-aadhaar',
        filePath: 'file:///docs/fallback.pdf',
      });
      getAllDocumentsMock.mockReturnValue([doc]);
      setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

      const { screen } = await renderScreen();

      await pressText(screen, 'Aadhaar Card');
      await pressText(screen, 'Fallback Doc');

      expect(openURLMock).toHaveBeenCalledTimes(1);
      expect(openURLMock).toHaveBeenCalledWith('file:///docs/fallback.pdf');
    } finally {
      storageModule.openPDF = original;
    }
  });

  test('Linking fallback prefixes file:// when the path lacks it', async () => {
    const original = storageModule.openPDF;
    storageModule.openPDF = undefined;
    try {
      const doc = makeDoc({
        title: 'No Scheme Doc',
        content: 'c-aadhaar',
        filePath: '/docs/noscheme.pdf',
      });
      getAllDocumentsMock.mockReturnValue([doc]);
      setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

      const { screen } = await renderScreen();

      await pressText(screen, 'Aadhaar Card');
      await pressText(screen, 'No Scheme Doc');

      expect(openURLMock).toHaveBeenCalledWith('file:///docs/noscheme.pdf');
    } finally {
      storageModule.openPDF = original;
    }
  });

  test('warns but does not crash when StorageModule.openPDF throws', async () => {
    storageModule.openPDF?.mockImplementation(() => {
      throw new Error('native crash');
    });
    const doc = makeDoc({
      title: 'Crash Doc',
      content: 'c-aadhaar',
      filePath: '/docs/crash.pdf',
    });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    await pressText(screen, 'Aadhaar Card');
    await pressText(screen, 'Crash Doc');

    expect(console.warn).toHaveBeenCalledWith(
      'Failed to open document:',
      expect.any(Error),
    );
    // The list is still intact after the failed open.
    expect(screen.getByText('Crash Doc')).toBeTruthy();
  });

  test('warns but does not crash when Linking.openURL throws', async () => {
    const original = storageModule.openPDF;
    storageModule.openPDF = undefined;
    openURLMock.mockImplementation(() => {
      throw new Error('cannot open url');
    });
    try {
      const doc = makeDoc({
        title: 'Bad Link Doc',
        content: 'c-aadhaar',
        filePath: '/docs/badlink.pdf',
      });
      getAllDocumentsMock.mockReturnValue([doc]);
      setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

      const { screen } = await renderScreen();

      await pressText(screen, 'Aadhaar Card');
      await pressText(screen, 'Bad Link Doc');

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to open document:',
        expect.any(Error),
      );
    } finally {
      storageModule.openPDF = original;
    }
  });

  // ── Refocus reload ───────────────────────────────────────────────────

  test('reloads documents when the screen regains focus', async () => {
    const first = makeDoc({ title: 'First Doc', content: 'c-aadhaar', filePath: '/docs/first.pdf' });
    getAllDocumentsMock.mockReturnValue([first]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();
    expect(getAllDocumentsMock).toHaveBeenCalledTimes(1);

    const second = makeDoc({ title: 'Second Doc', content: 'c-pan', filePath: '/docs/second.pdf' });
    getAllDocumentsMock.mockReturnValue([first, second]);
    setClassification('c-pan', asCategory('PAN_CARD', 'PAN Card', '💳', 93));

    await act(async () => {
      capturedFocusCallback?.();
    });

    expect(getAllDocumentsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Aadhaar Card')).toBeTruthy();
    expect(screen.getByText('PAN Card')).toBeTruthy();
  });

  test('stats update when refocused with new data', async () => {
    getAllDocumentsMock.mockReturnValue([]);
    const { screen } = await renderScreen();
    expect(screen.getByText('No documents indexed yet')).toBeTruthy();

    const docs = [
      makeDoc({ content: 'c-aadhaar', filePath: '/docs/a1.pdf' }),
      makeDoc({ content: 'c-aadhaar', filePath: '/docs/a2.pdf' }),
      makeDoc({ content: 'c-aadhaar', filePath: '/docs/a3.pdf' }),
    ];
    getAllDocumentsMock.mockReturnValue(docs);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    await act(async () => {
      capturedFocusCallback?.();
    });

    // The same mounted screen re-rendered: empty state gone, stats updated.
    expect(screen.queryByText('No documents indexed yet')).toBeNull();
    expect(screen.getByText('Aadhaar Card')).toBeTruthy();
    expect(screen.getByText('3 documents')).toBeTruthy();
  });

  // ── Footer ───────────────────────────────────────────────────────────

  test('renders the on-device privacy footer', async () => {
    const { screen } = await renderScreen();
    expect(
      screen.getByText('All classification is done on-device. No data leaves your phone.'),
    ).toBeTruthy();
  });

  // ── Text component sanity ────────────────────────────────────────────

  test('shows the classification emoji on each category card', async () => {
    const doc = makeDoc({ content: 'c-aadhaar', filePath: '/docs/a.pdf' });
    getAllDocumentsMock.mockReturnValue([doc]);
    setClassification('c-aadhaar', asCategory('AADHAAR_CARD', 'Aadhaar Card', '🪪', 95));

    const { screen } = await renderScreen();

    expect(screen.getAllByText('🪪').length).toBeGreaterThan(0);
  });
});
