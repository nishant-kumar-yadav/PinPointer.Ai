/**
 * Tests for src/database/connection.ts and src/database/transactions.ts.
 *
 * Strategy: exercise the REAL modules against the repo's in-memory
 * op-sqlite mock (auto-applied via moduleNameMapper — `import { open }`
 * in this file resolves to the very same mock instance the source uses).
 * The mock implements genuine transaction semantics (snapshot stack for
 * BEGIN/COMMIT/ROLLBACK), so rollback/commit tests assert real behavior.
 *
 * Isolation: the connection module holds a process-wide singleton whose
 * handle the mock caches by name. Each test wipes the handle via the
 * mock's own `__reset()` test helper, then re-runs setupDatabase().
 */
import type { Scalar } from '@op-engineering/op-sqlite';
import { open as openDb } from '@op-engineering/op-sqlite';
import {
  getDb,
  closeDatabase,
  setupDatabase,
  isFtsAvailable,
  isVecAvailable,
} from '../connection';
import {
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} from '../transactions';
import { indexDocument, getIndexedCount, isFileIndexed } from '../documents';
import { indexEmbedding, hasEmbedding, getEmbeddingCount } from '../vectors';

// The mocked `open` is a jest.fn (see __mocks__/op-sqlite.js).
const openMock = jest.mocked(openDb);

/** Wipe the in-memory handle via the mock's test helper (not public API). */
const resetHandle = () => {
  (getDb() as unknown as { __reset: () => void }).__reset();
};

/** Insert a document or fail loudly — keeps transaction tests honest. */
const insertDoc = (filePath: string, content = 'transaction test content'): number => {
  const id = indexDocument(null, content, filePath, 'IMAGE', 'TEXT');
  if (id === null) {
    throw new Error(`indexDocument unexpectedly returned null for ${filePath}`);
  }
  return id;
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resetHandle();
  setupDatabase();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── setupDatabase ──────────────────────────────────────────────────────────

describe('setupDatabase', () => {
  test('is idempotent: repeated calls do not throw and leave the DB usable', () => {
    expect(() => {
      setupDatabase();
      setupDatabase();
      setupDatabase();
    }).not.toThrow();
    const id = insertDoc('/idempotent.jpg');
    expect(isFileIndexed('/idempotent.jpg')).toBe(true);
    expect(getIndexedCount()).toBe(1);
    expect(id).toBeGreaterThan(0);
  });

  test('reports FTS5 and sqlite-vec as available when their DDL succeeds', () => {
    // With the in-memory mock, DDL statements are no-ops that succeed.
    expect(isFtsAvailable()).toBe(true);
    expect(isVecAvailable()).toBe(true);
  });

  test('attempts to enable WAL mode during setup', () => {
    const execSpy = jest.spyOn(getDb(), 'executeSync');
    setupDatabase();
    const statements = execSpy.mock.calls.map((call) => call[0]);
    expect(statements.some((q) => /journal_mode\s*=\s*WAL/i.test(q))).toBe(true);
  });

  test('marks FTS5/sqlite-vec unavailable when their DDL throws, then recovers', () => {
    const db = getDb();
    const realExec = db.executeSync.bind(db);
    const execSpy = jest
      .spyOn(db, 'executeSync')
      .mockImplementation((sql: string, params?: Scalar[]) => {
        if (/CREATE VIRTUAL TABLE/i.test(sql)) {
          throw new Error('no such module: fts5');
        }
        return realExec(sql, params);
      });

    expect(isFtsAvailable()).toBe(true); // sanity: set by beforeEach
    setupDatabase();
    expect(isFtsAvailable()).toBe(false);
    expect(isVecAvailable()).toBe(false);

    // Healing: a later successful setup flips the flags back on.
    execSpy.mockRestore();
    setupDatabase();
    expect(isFtsAvailable()).toBe(true);
    expect(isVecAvailable()).toBe(true);
  });

  test('survives a failed open during setup without throwing', () => {
    closeDatabase(); // force getDb() to call open() again
    openMock.mockImplementationOnce(() => {
      throw new Error('disk is gone');
    });
    expect(() => setupDatabase()).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(
      '[DB] Setup Failed:',
      expect.any(Error)
    );
    // The next setup recovers on a fresh open.
    setupDatabase();
    expect(getIndexedCount()).toBe(0);
  });
});

// ─── getDb ──────────────────────────────────────────────────────────────────

describe('getDb', () => {
  test('returns the same singleton handle without re-opening', () => {
    openMock.mockClear();
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
    expect(openMock).not.toHaveBeenCalled();
  });

  test('lazily re-opens the database on next access after closeDatabase', () => {
    closeDatabase();
    openMock.mockClear();
    const db = getDb();
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith({ name: 'pinpoint.db' });
    expect(db).toBeDefined();
  });
});

// ─── closeDatabase ──────────────────────────────────────────────────────────

describe('closeDatabase', () => {
  test('closes the underlying handle', () => {
    const closeSpy = jest.spyOn(getDb(), 'close');
    closeDatabase();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  test('a second close is a no-op', () => {
    const closeSpy = jest.spyOn(getDb(), 'close');
    closeDatabase();
    closeDatabase();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  test('does not throw when the handle fails to close', () => {
    const db = getDb();
    jest.spyOn(db, 'close').mockImplementation(() => {
      throw new Error('close failed');
    });
    expect(() => closeDatabase()).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(
      '[DB] Failed to close database safely',
      expect.any(Error)
    );
    // A failed close leaves the handle in place (documented behavior).
    expect(getDb()).toBe(db);
  });

  test('the database remains usable after close via lazy reopen', () => {
    closeDatabase();
    const id = insertDoc('/reopen.jpg', 'content after reopen');
    expect(id).toBeGreaterThan(0);
    expect(getIndexedCount()).toBe(1);
    expect(isFileIndexed('/reopen.jpg')).toBe(true);
  });
});

// ─── transactions ───────────────────────────────────────────────────────────

describe('transactions', () => {
  test('begin + inserts + commit persists every document', () => {
    beginTransaction();
    insertDoc('/tx-a.jpg');
    insertDoc('/tx-b.jpg');
    insertDoc('/tx-c.jpg');
    commitTransaction();
    expect(getIndexedCount()).toBe(3);
    expect(isFileIndexed('/tx-a.jpg')).toBe(true);
    expect(isFileIndexed('/tx-b.jpg')).toBe(true);
    expect(isFileIndexed('/tx-c.jpg')).toBe(true);
  });

  test('begin + inserts + rollback discards every document', () => {
    beginTransaction();
    insertDoc('/rb-a.jpg');
    insertDoc('/rb-b.jpg');
    expect(getIndexedCount()).toBe(2);
    rollbackTransaction();
    expect(getIndexedCount()).toBe(0);
    expect(isFileIndexed('/rb-a.jpg')).toBe(false);
  });

  test('rollback restores the pre-transaction state, not an empty DB', () => {
    insertDoc('/before.jpg');
    beginTransaction();
    insertDoc('/during-a.jpg');
    insertDoc('/during-b.jpg');
    expect(getIndexedCount()).toBe(3);
    rollbackTransaction();
    expect(getIndexedCount()).toBe(1);
    expect(isFileIndexed('/before.jpg')).toBe(true);
    expect(isFileIndexed('/during-a.jpg')).toBe(false);
  });

  test('supports nested transactions: inner rollback keeps outer work', () => {
    beginTransaction();
    insertDoc('/outer.jpg');
    beginTransaction();
    insertDoc('/inner.jpg');
    expect(getIndexedCount()).toBe(2);
    rollbackTransaction(); // inner
    expect(getIndexedCount()).toBe(1);
    expect(isFileIndexed('/outer.jpg')).toBe(true);
    expect(isFileIndexed('/inner.jpg')).toBe(false);
    commitTransaction(); // outer
    expect(getIndexedCount()).toBe(1);
  });

  test('outer rollback discards inner-committed work', () => {
    beginTransaction();
    insertDoc('/outer.jpg');
    beginTransaction();
    insertDoc('/inner.jpg');
    commitTransaction(); // inner
    expect(getIndexedCount()).toBe(2);
    rollbackTransaction(); // outer → back to the outer snapshot
    expect(getIndexedCount()).toBe(0);
  });

  test('begin/commit/rollback with no active transaction do not throw', () => {
    expect(() => commitTransaction()).not.toThrow();
    expect(() => rollbackTransaction()).not.toThrow();
    expect(() => beginTransaction()).not.toThrow();
    expect(() => commitTransaction()).not.toThrow();
  });

  test('rollback with no active transaction preserves existing data', () => {
    insertDoc('/kept.jpg');
    expect(() => rollbackTransaction()).not.toThrow();
    expect(getIndexedCount()).toBe(1);
    expect(isFileIndexed('/kept.jpg')).toBe(true);
  });

  test('transaction helpers issue real BEGIN/COMMIT/ROLLBACK statements', () => {
    const execSpy = jest.spyOn(getDb(), 'executeSync');
    beginTransaction();
    commitTransaction();
    beginTransaction();
    rollbackTransaction();
    const statements = execSpy.mock.calls.map((call) =>
      call[0].toUpperCase()
    );
    expect(statements).toContain('BEGIN TRANSACTION;');
    expect(statements).toContain('COMMIT;');
    expect(statements).toContain('ROLLBACK;');
  });

  test('rolls back vector inserts as well as documents', () => {
    const id = insertDoc('/vec-tx.jpg', 'vector rollback content');
    beginTransaction();
    indexEmbedding(id, new Float32Array(512).fill(0.5));
    expect(hasEmbedding(id)).toBe(true);
    rollbackTransaction();
    expect(hasEmbedding(id)).toBe(false);
    expect(getEmbeddingCount()).toBe(0);
    // The document itself (inserted outside the tx) survives.
    expect(isFileIndexed('/vec-tx.jpg')).toBe(true);
  });

  test('skipped (empty) documents do not disturb the transaction', () => {
    beginTransaction();
    const skipped = indexDocument(null, '   ', '/empty.jpg', 'IMAGE', 'TEXT');
    expect(skipped).toBeNull();
    insertDoc('/real.jpg');
    commitTransaction();
    expect(getIndexedCount()).toBe(1);
    expect(isFileIndexed('/empty.jpg')).toBe(false);
  });
});
