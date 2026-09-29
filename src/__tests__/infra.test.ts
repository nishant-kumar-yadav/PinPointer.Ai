/**
 * infra.test.ts — Phase 1 smoke test.
 *
 * Proves the test infrastructure works end-to-end:
 *   1. jest.setup.js NativeModules stubs are in place
 *   2. the in-memory @op-engineering/op-sqlite mock runs real Database.ts SQL
 *   3. ML Kit / ImageResizer / RNFS mocks let VisionPipeline execute
 *
 * This file stays as a permanent guard for the test infrastructure.
 */
import { NativeModules } from 'react-native';
import {
  setupDatabase,
  indexDocument,
  searchDocuments,
  getIndexedCount,
  clearIndex,
} from '../database';
import { analyzeImage } from '../utils/VisionPipeline';

describe('Phase 1 infrastructure', () => {
  test('NativeModules stubs from jest.setup.js exist', () => {
    expect(NativeModules.MobileCLIPModule).toBeDefined();
    expect(NativeModules.NativePdfModule).toBeDefined();
    expect(NativeModules.SherpaOnnxModule).toBeDefined();
    expect(NativeModules.StorageModule).toBeDefined();
    expect(typeof NativeModules.NativePdfModule.getPdfInfo).toBe('function');
  });

  test('in-memory SQLite mock runs Database.ts for real', () => {
    setupDatabase();
    clearIndex();
    expect(getIndexedCount()).toBe(0);

    const id = indexDocument('Aadhaar Card', 'Government of India Aadhaar card document', '/docs/aadhaar.pdf', 'DOCUMENT', 'TEXT');
    expect(id).not.toBeNull();

    expect(getIndexedCount()).toBe(1);

    // FTS path: multi-word AND query
    const hits = searchDocuments('aadhaar card');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].filePath).toBe('/docs/aadhaar.pdf');

    // LIKE fallback path still finds it via synonym expansion
    const likeHits = searchDocuments('uidai');
    expect(likeHits.length).toBeGreaterThan(0);
  });

  test('PII is masked at index time through the mock DB', () => {
    setupDatabase();
    clearIndex();
    indexDocument(null, 'My aadhaar is 1234 5678 9012 ok', '/docs/x.pdf', 'DOCUMENT', 'TEXT');
    const hits = searchDocuments('aadhaar');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content).toContain('****-****-9012');
    expect(hits[0].content).not.toContain('1234 5678 9012');
  });

  test('VisionPipeline runs with mocked ML Kit (EMPTY path)', async () => {
    const result = await analyzeImage('file:///photo.jpg');
    expect(result.detection_type).toBe('EMPTY');
    expect(result.optimized_status).toBe('Object_Detection_Bypassed: False');
    expect(result.content).toBe('');
  });
});
