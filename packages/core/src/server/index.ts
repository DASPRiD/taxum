/**
 * Core functionality to create an HTTP server from a router.
 *
 * @see {@link serve}
 * @packageDocumentation
 */

import assert from "node:assert";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpRequest } from "../http/index.js";
import { getGlobalLogger } from "../logger/index.js";
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
    hostname?: number | undefined;

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
     * Maximum time (in milliseconds) to wait before returning.
     *
     * This will `unref` the server once the timeout expired and return early. The server will still be open until your
     * program exits.
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
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const httpRequests = HttpRequest.fromIncomingMessage(req, config?.trustProxy ?? false);
            const response = await service.invoke(httpRequests);
            await response.write(res);
        } catch (error) {
            getGlobalLogger().error("Uncaught error in router", error);

            try {
                res.statusCode = 500;
                res.end();
                /* node:coverage ignore next 3 */
            } catch {
                // Noop
            }
        }
    });

    if (config?.unrefOnStart) {
        server.unref();
    }

    const abortController = new AbortController();
    let closing = false;

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
            setTimeout(() => {
                abortController.abort();
            }, config.shutdownTimeout);
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

        abortController.signal.addEventListener("abort", () => {
            resolve();
        });
    });
};
