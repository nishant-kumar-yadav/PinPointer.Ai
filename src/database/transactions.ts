/**
 * Batch transaction support — wrap bulk inserts in BEGIN/COMMIT
 * for 3-5x speed boost during sync.
 */
import { getDb } from './connection';

export const beginTransaction = () => {
  try { getDb().executeSync('BEGIN TRANSACTION;'); } catch { }
};

export const commitTransaction = () => {
  try { getDb().executeSync('COMMIT;'); } catch { }
};

export const rollbackTransaction = () => {
  try { getDb().executeSync('ROLLBACK;'); } catch { }
};
