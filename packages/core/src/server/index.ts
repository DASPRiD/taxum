/**
 * Core functionality to create an HTTP server from a router.
 *
 * @see {@link serve}
 * @packageDocumentation
 */

import assert from "node:assert";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpRequest, HttpResponse, StatusCode } from "../http/index.js";
import { getLoggerProxy } from "../logging/index.js";
import type { HttpService } from "../service/index.js";

/**
 * Configuration options for starting a server.
 */
export type ServeConfig = {
    /**
     * Port to run the server on.
     *
     * Defaults to random available port.
     */
    port?: number | undefined;

    /**
     * Hostname to bind the server to.
     *
     * Defaults to not specific binding.
     */
    hostname?: string | undefined;

    /**
     * Whether to trust proxy headers.
     *
     * When set to true, `forwarded-for-*` headers will be considered.
     */
    trustProxy?: boolean;

    /**
     * Signal to shut down the server.
     */
    abortSignal?: AbortSignal;

    /**
     * Catches `CTRL+C` and shuts down the server gracefully.
     */
    catchCtrlC?: boolean;

    /**
     * Maximum time (in milliseconds) to wait for open connections to close during shutdown.
     *
     * Once the timeout expires, all remaining connections are forcefully closed and their
     * response body streams are cancelled. Without this, the server waits indefinitely for
     * long-running responses (e.g. streams) to finish.
     */
    shutdownTimeout?: number;

    /**
     * Starts the server in `unref`ed mode.
     *
     * This is primarily useful in test environments so that an unclosed server doesn't prevent your tests from
     * existing.
     */
    unrefOnStart?: boolean;

    /**
     * Called once the server started listening.
     */
    onListen?: (address: AddressInfo) => void;
};

/**
 * Serve any service via HTTP.
 *
 * This method of running a service is intentionally simple and only supports
 * the minimally required configuration. If you need to support HTTPS and/or
 * HTTP2, you should create your own listener. In most cases this should not be
 * required, as TLS termination and HTTP2 are usually handled by a reverse proxy
 * in production.
 *
 * @example
 * ```ts
 * const router = new Router()
 *     .route("/", get(() => HttpResponse.builder().raw("Hello world!"));
 *
 * await serve(router, {
 *     port: 8080,
 *     catchCtrlC: true,
 *     shutdownTimeout: 3000,
 * });
 * ```
 */
export const serve = async (service: HttpService, config?: ServeConfig): Promise<void> => {
    let closing = false;

    const writeResponse = async (response: HttpResponse, res: ServerResponse): Promise<void> => {
        if (closing) {
            // Tell keep-alive clients to stop reusing this connection; Node.js closes the
            // socket once the response has finished.
            response.headers.insert("connection", "close");
        }

        await response.write(res);
    };

    const respond = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        let httpRequest: HttpRequest;

        try {
            httpRequest = HttpRequest.fromIncomingMessage(req, config?.trustProxy ?? false);
        } catch {
            const response = HttpResponse.builder()
                .status(StatusCode.BAD_REQUEST)
                .body("Malformed HTTP request");
            await writeResponse(response, res);
            return;
        }

        try {
            const response = await service.invoke(httpRequest);
            await writeResponse(response, res);
        } catch (error) {
            getLoggerProxy().error("Uncaught error in router", { error });

            try {
                res.statusCode = 500;
                res.end();
                /* node:coverage ignore next 3 */
            } catch {
                // Noop
            }
        }
    };

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        await respond(req, res);

        // Responses whose headers were already sent when shutdown began cannot carry a
        // `connection: close` header, so their sockets must be torn down explicitly once the
        // response has finished.
        if (closing && !req.socket.destroyed) {
            req.socket.destroySoon();
        }
    });

    if (config?.unrefOnStart) {
        server.unref();
    }

    const closeServer = (): void => {
        /* node:coverage ignore next 3 */
        if (closing) {
            return;
        }

        // It's important to clean up here so that Node.js will handle future signals.
        process.removeAllListeners("SIGINT");
        process.removeAllListeners("SIGQUIT");
        process.removeAllListeners("SIGTERM");

        closing = true;
        server.close();

        if (config?.shutdownTimeout) {
            const forceCloseTimer = setTimeout(() => {
                server.closeAllConnections();
            }, config.shutdownTimeout);

            server.once("close", () => {
                clearTimeout(forceCloseTimer);
            });
        }
    };

    config?.abortSignal?.addEventListener("abort", closeServer);

    if (config?.catchCtrlC) {
        process.addListener("SIGINT", closeServer);
        process.addListener("SIGQUIT", closeServer);
        process.addListener("SIGTERM", closeServer);
    }

    return new Promise<void>((resolve, reject) => {
        server.on("error", reject);

        server.on("close", () => {
            resolve();
        });

        server.listen(config?.port, config?.hostname, () => {
            const address = server.address();
            assert(
                address !== null && typeof address !== "string",
                "server address should always be an AddressInfo. This is a bug in taxum. Please file an issue.",
            );

            config?.onListen?.(address);
        });
    });
};
