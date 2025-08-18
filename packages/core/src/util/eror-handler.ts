import { AsyncLocalStorage } from "node:async_hooks";
import { HttpResponse, isToHttpResponse, StatusCode, TO_HTTP_RESPONSE } from "../http/index.js";
import { getGlobalLogger } from "../logger/index.js";

/**
 * Represents an error handler which converts any error into a response.
 *
 * Any error handler must be infallible and never throw an error by itself, as
 * this would short-circuit any upper middleware and prevent them from running.
 */
export type ErrorHandler = (error: unknown) => HttpResponse;

/**
 * The default error handler which converts any error into a response.
 */
export const defaultErrorHandler = (error: unknown) => {
    if (isToHttpResponse(error)) {
        const res = error[TO_HTTP_RESPONSE]();

        if (res.status.isServerError()) {
            getGlobalLogger().error("failed to serve request", error);
        }

        return res;
    }

    getGlobalLogger().error("failed to serve request", error);

    return HttpResponse.builder().status(StatusCode.INTERNAL_SERVER_ERROR).body(null);
};

const errorHandlerStorage = new AsyncLocalStorage<ErrorHandler>();

/**
 * Retrieves the current error handler from the storage or returns the default
 * error handler.
 *
 * This function is used to obtain the appropriate error handling mechanism for
 * the current context. If an error handler is stored in the error handler
 * storage, it will be returned. Otherwise, the default error handler will be
 * used.
 *
 * @internal
 */
export const getErrorHandler = (): ErrorHandler =>
    /* node:coverage ignore next */
    errorHandlerStorage.getStore() ?? defaultErrorHandler;

/**
 * Executes a given asynchronous function within the context of a specified
 * error handler.
 *
 * If no error handler is provided, the default error handler will be used.
 *
 * @internal
 */
export const runWithErrorHandler = <T>(
    handler: ErrorHandler | null,
    f: () => Promise<T>,
): Promise<T> => {
    return errorHandlerStorage.run(handler ?? defaultErrorHandler, f);
};
