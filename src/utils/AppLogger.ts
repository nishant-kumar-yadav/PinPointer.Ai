/**
 * Centralized app logger — replaces silent catch blocks.
 * In dev: logs to console. Stores last N errors for debugging.
 */

const MAX_LOG_ENTRIES = 50;

interface LogEntry {
    level: 'info' | 'warn' | 'error';
    tag: string;
    message: string;
    timestamp: number;
    detail?: unknown;
}

const _logs: LogEntry[] = [];

const push = (entry: LogEntry) => {
    _logs.push(entry);
    if (_logs.length > MAX_LOG_ENTRIES) _logs.shift();
};

export const AppLogger = {
    /** Log an informational message under a tag. */
    info: (tag: string, message: string, detail?: unknown) => {
        console.log(`[${tag}] ${message}`, detail ?? '');
        push({ level: 'info', tag, message, timestamp: Date.now(), detail });
    },

    /** Log a warning under a tag. */
    warn: (tag: string, message: string, detail?: unknown) => {
        console.warn(`[${tag}] ${message}`, detail ?? '');
        push({ level: 'warn', tag, message, timestamp: Date.now(), detail });
    },

    /** Log an error under a tag. */
    error: (tag: string, message: string, detail?: unknown) => {
        console.error(`[${tag}] ${message}`, detail ?? '');
        push({ level: 'error', tag, message, timestamp: Date.now(), detail });
    },

    /** Get recent log entries (newest first) */
    getRecent: (count = 20): LogEntry[] =>
        _logs.slice(-count).reverse(),

    /** Get only errors */
    getErrors: (): LogEntry[] =>
        _logs.filter(l => l.level === 'error').reverse(),
};
