import { randomUUID } from "node:crypto";
import { ExtensionKey, type HttpRequest } from "../http/index.js";
import type { Layer } from "../routing/index.js";

export const REQUEST_ID = new ExtensionKey<string>("Request ID");
const DEFAULT_HEADER_NAME = "x-request-id";

export type MakeRequestId = (req: HttpRequest) => string | null;

/**
 * Configuration object for working with request IDs.
 */
export type RequestIdConfig = {
    /**
     * Callback function to generate a unique request ID.
     *
     * Defaults to UUID.
     */
    makeRequestId?: MakeRequestId;

    /**
     * Header name to retrieve a request ID from.
     *
     * Defaults to `X-Request-ID`.
     */
    headerName?: string;
};

/**
 * A layer that manages request IDs for incoming requests.
 *
 * This function ensures that each request is associated with a unique identifier,
 * which can be either provided in the request headers or dynamically generated.
 */
export const setRequestIdLayer = (config?: RequestIdConfig): Layer => {
    const headerName = config?.headerName ?? DEFAULT_HEADER_NAME;
    const makeRequestId = config?.makeRequestId ?? (() => randomUUID());

    return {
        layer: (inner) => (req) => {
            const requestId = req.headers.get(headerName);

            if (requestId) {
                req.extensions.insert(REQUEST_ID, requestId);
                return inner(req);
            }

            const newRequestId = makeRequestId(req);

            if (newRequestId !== null) {
                req.headers.insert(headerName, newRequestId);
                return inner(req);
            }

            return inner(req);
        },
    };
};

/**
 * A layer that propagates a request ID header from the incoming request to the outgoing response.
 *
 * The purpose of this layer is to ensure consistency of the request ID header across the request-response cycle.
 * If the response does not already include the request ID header, it will include the one from the incoming request.
 * Additionally, the request ID is stored in the response extensions for further processing.
 *
 * If not set, the header name defaults to `X-Request-ID`.
 */
export const propagateRequestIdLayer = (headerNameOpt?: string): Layer => {
    const headerName = headerNameOpt ?? DEFAULT_HEADER_NAME;

    return {
        layer: (inner) => async (req) => {
            const response = (await inner(req)).toOwned();
            const requestRequestId = req.headers.get(headerName);
            const responseRequestId = response.headers.get(headerName);

            if (responseRequestId) {
                if (!response.extensions.has(REQUEST_ID)) {
                    response.extensions.insert(REQUEST_ID, responseRequestId);
                }
            } else if (requestRequestId) {
                response.headers.insert(headerName, requestRequestId);
                response.extensions.insert(REQUEST_ID, requestRequestId);
            }

            return response;
        },
    };
};
