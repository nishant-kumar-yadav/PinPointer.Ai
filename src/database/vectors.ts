/**
 * sqlite-vec embedding storage: per-document 512-dim vectors.
 */
import { getDb, isVecAvailable } from './connection';
import { AppLogger } from '../utils/AppLogger';

/** Store a 512-dim INT8 embedding vector for a document */
export const indexEmbedding = (documentId: number, embedding: Float32Array) => {
  if (!isVecAvailable()) return;
  try {
    const db = getDb();
    db.executeSync('DELETE FROM vec_index WHERE document_id = ?', [documentId]);
    db.executeSync(
      'INSERT INTO vec_index (document_id, embedding) VALUES (?, vec_f32(?))',
      [documentId, new Uint8Array(embedding.buffer)]
    );
    AppLogger.info('DB', `Vector indexed ✅ doc_id=${documentId}`);
  } catch (e) {
    AppLogger.warn('DB', 'Vector index failed:', e);
  }
};

/** Check if a document has an embedding stored */
export const hasEmbedding = (documentId: number): boolean => {
  if (!isVecAvailable()) return false;
  try {
    const db = getDb();
    const result = db.executeSync(
      'SELECT document_id FROM vec_index WHERE document_id = ? LIMIT 1',
      [documentId]
    );
    const rows = result?.rows || [];
    return rows.length > 0;
  } catch {
    return false;
  }
};

/** Get embedding count for stats */
export const getEmbeddingCount = (): number => {
  if (!isVecAvailable()) return 0;
  try {
    const db = getDb();
    const result = db.executeSync('SELECT COUNT(*) as cnt FROM vec_index');
    const rows = result?.rows || [];
    return rows.length > 0 ? (rows[0] as { cnt: number }).cnt : 0;
  } catch {
    return 0;
  }
};
