/**
 * @deprecated Import from `./database` instead.
 *
 * Compatibility shim: re-exports the full public database API so every
 * pre-existing `from './Database'` / `from '../Database'` import keeps
 * working with zero breaking changes. New code should import from
 * `./database` directly.
 */
export * from './database';
