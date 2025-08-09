/**
 * Represents a logger utility for capturing and handling error messages.
 *
 * This type provides a structure for logging errors with an optional error
 * object for additional context.
 */
export type Logger = {
    error: (message: string, error?: unknown) => void;
    warn: (message: string) => void;
    info: (message: string) => void;
};

const defaultLogger: Logger = {
    error: (message: string, error?: unknown) => {
        console.error(message, error);
    },
    warn: (message: string) => {
        console.warn(message);
    },
    info: (message: string) => {
        console.info(message);
    },
};

let globalLogger: Logger = defaultLogger;

/**
 * Sets the global logger instance to be used throughout the router.
 */
export const setGlobalLogger = (logger: Logger) => {
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
