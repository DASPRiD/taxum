/** biome-ignore-all lint/suspicious/noConsole: required for default logger */

/**
 * Supported log levels.
 */
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Proxy for logging functions.
 *
 * Taxum will, by convention, include any error object if present under the
 * `error` key.
 */
export type LogFnProxy = (message: string, values?: Record<string, unknown>) => void;

/**
 * A `LogProxy` forwards logging calls from Taxum to any logging framework.
 */
export type LoggerProxy = Record<LogLevel, LogFnProxy>;

const defaultLogger: LoggerProxy = {
    fatal: (message, values) => {
        console.error(message, values);
    },
    error: (message, values) => {
        console.error(message, values);
    },
    warn: (message, values) => {
        console.warn(message, values);
    },
    info: (message, values) => {
        console.info(message, values);
    },
    debug: (message, values) => {
        console.debug(message, values);
    },
    trace: (message, values) => {
        console.trace(message, values);
    },
};

let globalLogger: LoggerProxy = defaultLogger;

/**
 * Sets the global logger instance to be used throughout the router.
 */
export const setGlobalLogger = (logger: LoggerProxy) => {
    globalLogger = logger;
};

/**
 * Retrieves the global logger instance.
 */
export const getGlobalLogger = () => globalLogger;

/**
 * Resets the global logger to the default logger instance.
 */
export const resetGlobalLogger = () => setGlobalLogger(defaultLogger);
