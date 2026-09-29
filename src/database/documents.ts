/**
 * Document CRUD: indexing, existence checks, counts, clearing, vault listing.
 */
import { maskSensitiveData } from '../utils/DataMasking';
import { getDb, isFtsAvailable } from './connection';
import type { DocumentRecord } from './types';

/**
 * Maps raw DB rows to DocumentRecord objects.
 * @internal Shared with search.ts; not part of the public barrel.
 */
export const processResults = (result: any): DocumentRecord[] => {
  const rows = result?.rows || [];
  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    filePath: row.filePath,
    type: row.type,
    detection_type: row.detection_type,
    timestamp: row.timestamp,
  })) as DocumentRecord[];
};

export const isFileIndexed = (path: string): boolean => {
  try {
    const db = getDb();
    const result = db.executeSync('SELECT id FROM document_index WHERE filePath = ? LIMIT 1', [path]);
    const rows = result?.rows || [];
    return rows.length > 0;
  } catch (e) {
    console.warn('[DB] isFileIndexed check failed:', e);
    return false;
  }
};

export const indexDocument = (
  title: string | null = null,
  content: string,
  filePath: string,
  type: 'IMAGE' | 'DOCUMENT',
  detection_type: 'TEXT' | 'OBJECT'
): number | null => {
  // C2 fix: Mask PII (Aadhaar/PAN/phone) at the single chokepoint so no caller can bypass it
  content = maskSensitiveData(content ?? '');

  if (!content.trim() && !title?.trim()) {
    console.log('[DB] Skipped empty indexing for:', filePath);
    return null;
  }

  try {
    const db = getDb();
    // Always DELETE first to ensure FTS triggers fire correctly for updates
    db.executeSync('DELETE FROM document_index WHERE filePath = ?', [filePath]);
    db.executeSync(
      'INSERT INTO document_index (title, content, filePath, type, detection_type, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content.trim(), filePath, type, detection_type, Date.now()]
    );
    const idResult = db.executeSync('SELECT last_insert_rowid() as id');
    const idRows = idResult?.rows || [];
    const insertedId = idRows.length > 0 ? (idRows[0] as { id: number }).id : null;
    console.log(`[DB] Indexed ✅ [${type}] ${filePath} (id=${insertedId})`);
    return insertedId;
  } catch (e) {
    console.error('[DB] Save Failed:', e);
    return null;
  }
};

/** Returns the total number of indexed documents */
export const getIndexedCount = (): number => {
  try {
    const db = getDb();
    const result = db.executeSync('SELECT COUNT(*) as cnt FROM document_index');
    const rows = result?.rows || [];
    return rows.length > 0 ? (rows[0] as { cnt: number }).cnt : 0;
  } catch (e) {
    console.warn('[DB] Count Failed:', e);
    return 0;
  }
};

/** Clears all indexed documents — useful for a forced full re-index */
export const clearIndex = () => {
  try {
    const db = getDb();
    db.executeSync('DELETE FROM document_index');
    if (isFtsAvailable()) {
      try { db.executeSync('DELETE FROM fts_index'); } catch { }
    }
    console.log('[DB] Index cleared');
  } catch (e) {
    console.error('[DB] Clear Failed:', e);
  }
};

/** Returns all documents of type 'DOCUMENT' for the vault screen */
export const getAllDocuments = (): DocumentRecord[] => {
  try {
    const db = getDb();
    const result = db.execute(
      `SELECT id, title, content, filePath, type, detection_type, timestamp
       FROM document_index
       WHERE type = 'DOCUMENT'
       ORDER BY timestamp DESC`
    );
    return processResults(result);
  } catch (e) {
    console.warn('[DB] getAllDocuments failed:', e);
    return [];
  }
};
