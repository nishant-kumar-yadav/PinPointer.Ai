/**
 * Batch transaction support — wrap bulk inserts in BEGIN/COMMIT
 * for 3-5x speed boost during sync.
 */
import { getDb } from './connection';

/** Starts a batch transaction — wrap bulk inserts for a 3-5x sync speed boost. */
export const beginTransaction = () => {
  try { getDb().executeSync('BEGIN TRANSACTION;'); } catch { }
};

/** Commits the current batch transaction. */
export const commitTransaction = () => {
  try { getDb().executeSync('COMMIT;'); } catch { }
};

/** Rolls back the current batch transaction. */
export const rollbackTransaction = () => {
  try { getDb().executeSync('ROLLBACK;'); } catch { }
};
