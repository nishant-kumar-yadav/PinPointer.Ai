/**
 * Database connection management: singleton handle, schema setup,
 * capability flags (FTS5 / sqlite-vec), and teardown.
 */
import { open } from '@op-engineering/op-sqlite';
import { AppLogger } from '../utils/AppLogger';

// ─── Singleton DB ───────────────────────────────────────────────────────────

let _db: ReturnType<typeof open> | null = null;

/** Internal accessor for the singleton connection. Opens lazily. */
export const getDb = (): ReturnType<typeof open> => {
  if (!_db) {
    _db = open({ name: 'pinpoint.db' });
  }
  return _db;
};

export const closeDatabase = () => {
  if (_db) {
    try {
      _db.close();
      _db = null;
      AppLogger.info('DB', 'Database Connection Closed safely');
    } catch (e) {
      AppLogger.error('DB', 'Failed to close database safely', e);
    }
  }
};

// ─── Capability flags ───────────────────────────────────────────────────────
// Set during setupDatabase(); read by search.ts and vectors.ts.

let _ftsAvailable = false;
let _vecAvailable = false;

/** True when the FTS5 virtual table was created successfully. */
export const isFtsAvailable = (): boolean => _ftsAvailable;

/** True when the sqlite-vec virtual table was created successfully. */
export const isVecAvailable = (): boolean => _vecAvailable;

// ─── Schema Setup ───────────────────────────────────────────────────────────

export const setupDatabase = () => {
  try {
    const db = getDb();

    // Enable WAL mode for 2-3x faster concurrent reads/writes during sync
    try { db.executeSync('PRAGMA journal_mode=WAL;'); } catch { }

    // Main data table — always required
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS document_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        filePath TEXT UNIQUE,
        type TEXT DEFAULT 'IMAGE',
        detection_type TEXT DEFAULT 'TEXT',
        timestamp INTEGER
      );
    `);

    // Add columns if upgrading from old schema (safe to run even if column exists)
    try { db.executeSync(`ALTER TABLE document_index ADD COLUMN title TEXT;`); } catch { }
    try { db.executeSync(`ALTER TABLE document_index ADD COLUMN type TEXT DEFAULT 'IMAGE';`); } catch { }
    try { db.executeSync(`ALTER TABLE document_index ADD COLUMN detection_type TEXT DEFAULT 'TEXT';`); } catch { }
    try { db.executeSync(`ALTER TABLE document_index ADD COLUMN timestamp INTEGER;`); } catch { }
    try { db.executeSync(`ALTER TABLE document_index ADD COLUMN page_count INTEGER DEFAULT 0;`); } catch { }
    try { db.executeSync(`ALTER TABLE document_index ADD COLUMN pdf_status TEXT DEFAULT 'PENDING';`); } catch { }

    // Try FTS5 (may not be compiled into this SQLite build)
    try {
      db.executeSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
          content,
          filePath UNINDEXED,
          tokenize = 'unicode61'
        );
      `);

      db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS fts_insert AFTER INSERT ON document_index BEGIN
          INSERT INTO fts_index(rowid, content, filePath)
          VALUES (NEW.id, NEW.content, NEW.filePath);
        END;
      `);

      db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS fts_delete AFTER DELETE ON document_index BEGIN
          DELETE FROM fts_index WHERE rowid = OLD.id;
        END;
      `);

      db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS fts_update AFTER UPDATE OF content ON document_index BEGIN
          DELETE FROM fts_index WHERE rowid = OLD.id;
          INSERT INTO fts_index(rowid, content, filePath)
          VALUES (NEW.id, NEW.content, NEW.filePath);
        END;
      `);

      _ftsAvailable = true;
      AppLogger.info('DB', 'Database Ready (FTS5 enabled)');
    } catch (ftsError) {
      _ftsAvailable = false;
      AppLogger.warn('DB', 'FTS5 not available, using LIKE fallback:', ftsError);
      AppLogger.info('DB', 'Database Ready (LIKE mode)');
    }

    // ─── sqlite-vec Vector Index ───────────────────────────────────────
    try {
      db.executeSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
          document_id INTEGER PRIMARY KEY,
          embedding float[512]
        );
      `);
      _vecAvailable = true;
      AppLogger.info('DB', 'Vector index ready (sqlite-vec enabled)');
    } catch (vecError) {
      _vecAvailable = false;
      AppLogger.warn('DB', 'sqlite-vec not available:', vecError);
    }
  } catch (error) {
    AppLogger.error('DB', 'Setup Failed:', error);
  }
};
