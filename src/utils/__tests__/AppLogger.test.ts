import { AppLogger } from '../AppLogger';

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('AppLogger.info', () => {
    it('calls console.log with "[TAG] message" format', () => {
        AppLogger.info('Search', 'indexing started');
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith('[Search] indexing started', '');
    });

    it('passes a detail object as the second console arg', () => {
        const detail = { count: 42, nested: { ok: true } };
        AppLogger.info('DB', 'query done', detail);
        expect(logSpy).toHaveBeenCalledWith('[DB] query done', detail);
    });

    it('passes empty string when detail is undefined or null', () => {
        AppLogger.info('T', 'no detail', undefined);
        AppLogger.info('T', 'null detail', null);
        expect(logSpy).toHaveBeenNthCalledWith(1, '[T] no detail', '');
        expect(logSpy).toHaveBeenNthCalledWith(2, '[T] null detail', '');
    });

    it('handles object args without throwing', () => {
        expect(() =>
            AppLogger.info('T', 'complex', { a: [1, 2, { b: 'x' }], c: null }),
        ).not.toThrow();
        expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it('does not call console.warn or console.error', () => {
        AppLogger.info('T', 'hello');
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

describe('AppLogger.warn', () => {
    it('calls console.warn with "[TAG] message" format', () => {
        AppLogger.warn('Sync', 'slow network');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('[Sync] slow network', '');
    });

    it('passes detail through to console.warn', () => {
        AppLogger.warn('Sync', 'retrying', { attempt: 3 });
        expect(warnSpy).toHaveBeenCalledWith('[Sync] retrying', { attempt: 3 });
    });

    it('does not call console.log or console.error', () => {
        AppLogger.warn('T', 'careful');
        expect(logSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

describe('AppLogger.error', () => {
    it('calls console.error with "[TAG] message" format', () => {
        AppLogger.error('DB', 'migration failed');
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('[DB] migration failed', '');
    });

    it('passes an Error object as detail without throwing', () => {
        const err = new Error('boom');
        expect(() => AppLogger.error('DB', 'caught', err)).not.toThrow();
        expect(errorSpy).toHaveBeenCalledWith('[DB] caught', err);
    });

    it('does not call console.log or console.warn', () => {
        AppLogger.error('T', 'bad');
        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

describe('AppLogger.getRecent', () => {
    it('returns entries newest-first', () => {
        AppLogger.info('REC-A', 'first');
        AppLogger.info('REC-B', 'second');
        const mine = AppLogger.getRecent(50).filter(
            (l) => l.tag === 'REC-A' || l.tag === 'REC-B',
        );
        expect(mine).toHaveLength(2);
        expect(mine[0]).toMatchObject({ tag: 'REC-B', message: 'second', level: 'info' });
        expect(mine[1]).toMatchObject({ tag: 'REC-A', message: 'first', level: 'info' });
    });

    it('respects the count limit', () => {
        AppLogger.info('COUNT-1', 'one');
        AppLogger.info('COUNT-2', 'two');
        AppLogger.info('COUNT-3', 'three');
        const recent = AppLogger.getRecent(2);
        expect(recent).toHaveLength(2);
        expect(recent[0].message).toBe('three');
        expect(recent[1].message).toBe('two');
    });

    it('stores tag, message, level, numeric timestamp and detail on each entry', () => {
        const before = Date.now();
        AppLogger.warn('SHAPE', 'shapely', { x: 1 });
        const after = Date.now();
        const entry = AppLogger.getRecent(1)[0];
        expect(entry.tag).toBe('SHAPE');
        expect(entry.message).toBe('shapely');
        expect(entry.level).toBe('warn');
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.timestamp).toBeGreaterThanOrEqual(before);
        expect(entry.timestamp).toBeLessThanOrEqual(after);
        expect(entry.detail).toEqual({ x: 1 });
    });
});

describe('AppLogger.getErrors', () => {
    it('returns only error entries, newest-first', () => {
        AppLogger.info('ERRF-INFO', 'fine');
        AppLogger.warn('ERRF-WARN', 'hmm');
        AppLogger.error('ERRF-ERR1', 'bad one');
        AppLogger.error('ERRF-ERR2', 'bad two');
        const errs = AppLogger.getErrors().filter((l) => l.tag.startsWith('ERRF-'));
        expect(errs).toHaveLength(2);
        expect(errs[0]).toMatchObject({ tag: 'ERRF-ERR2', level: 'error' });
        expect(errs[1]).toMatchObject({ tag: 'ERRF-ERR1', level: 'error' });
        expect(errs.every((l) => l.level === 'error')).toBe(true);
    });
});

describe('AppLogger log retention (must run last — it fills the buffer)', () => {
    it('keeps at most 50 entries, dropping the oldest', () => {
        for (let i = 0; i < 60; i++) {
            AppLogger.info('CAPTEST', `entry ${i}`);
        }
        const mine = AppLogger.getRecent(200).filter((l) => l.tag === 'CAPTEST');
        expect(mine).toHaveLength(50);
        expect(mine[0].message).toBe('entry 59'); // newest first
        expect(mine[49].message).toBe('entry 10'); // oldest surviving
    });
});
