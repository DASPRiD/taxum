import { randomUUID } from "node:crypto";
import { ExtensionKey, type HttpRequest, type HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

export const REQUEST_ID = new ExtensionKey<string>("Request ID");
const DEFAULT_HEADER_NAME = "x-request-id";

export type MakeRequestId = (req: HttpRequest) => string | null;

/**
 * A layer that manages request IDs for incoming requests.
 *
 * This function ensures that each request is associated with a unique
 * identifier, which can be either provided in the request headers or
 * dynamically generated.
 *
 * @example
 * ```ts
 * import { SetRequestIdLayer } from "@taxum/core/middleware/request-id";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(SetRequestIdLayer.default());
 * ```
 */
export class SetRequestIdLayer implements HttpLayer {
    private readonly headerName: string;
    private readonly makeRequestId: MakeRequestId;

    /**
     * Creates a new {@link SetRequestIdLayer}.
     *
     * @param headerName - the name of the header to be used.
     * @param makeRequestId - a function to generate a request ID.
     */
    public constructor(headerName?: string, makeRequestId?: MakeRequestId) {
        /* node:coverage ignore next 2 */
        this.headerName = headerName ?? DEFAULT_HEADER_NAME;
        this.makeRequestId = makeRequestId ?? (() => randomUUID());
    }

    /**
     * Creates a new middleware with the header name defaulting to `X-Request-Id`
     * with UUID request IDs.
     */
    public static default(): SetRequestIdLayer {
        return new SetRequestIdLayer(DEFAULT_HEADER_NAME, () => randomUUID());
    }

    public layer(inner: HttpService): HttpService {
        return new SetRequestId(inner, this.headerName, this.makeRequestId);
    }
}

class SetRequestId implements HttpService {
    private readonly inner: HttpService;
    private readonly headerName: string;
    private readonly makeRequestId: MakeRequestId;

    public constructor(inner: HttpService, headerName: string, makeRequestId: MakeRequestId) {
        this.inner = inner;
        this.headerName = headerName;
        this.makeRequestId = makeRequestId;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const requestId = req.headers.get(this.headerName);

        if (requestId) {
            req.extensions.insert(REQUEST_ID, requestId.value);
            return this.inner.invoke(req);
        }

        const newRequestId = this.makeRequestId(req);

        if (newRequestId !== null) {
            req.headers.insert(this.headerName, newRequestId);
            req.extensions.insert(REQUEST_ID, newRequestId);
            return this.inner.invoke(req);
        }

        return this.inner.invoke(req);
    }
}

/**
 * A layer that propagates a request ID header from the incoming request to the
 * outgoing response.
 *
 * The purpose of this layer is to ensure consistency of the request ID header
 * across the request-response cycle. If the response does not already include
 * the request ID header, it will include the one from the incoming request.
 * Additionally, the request ID is stored in the response extensions for further
 * processing.
 *
 * @example
 * ```ts
 * import { PropagateRequestId } from "@taxum/core/middleware/request-id";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(PropagateRequestIdLayer.default());
 * ```
 */
export class PropagateRequestIdLayer implements HttpLayer {
    private readonly headerName: string;

    /**
     * Creates a new {@link PropagateRequestIdLayer}.
     *
     * @param headerName - the name of the header to be used.
     */
    public constructor(headerName?: string) {
        /* node:coverage ignore next */
        this.headerName = headerName ?? DEFAULT_HEADER_NAME;
    }

    /**
     * Creates a new middleware with the header name defaulting to `X-Request-Id`.
     */
    public static default(): PropagateRequestIdLayer {
        return new PropagateRequestIdLayer(DEFAULT_HEADER_NAME);
    }

    public layer(inner: HttpService): HttpService {
        return new PropagateRequestId(inner, this.headerName);
    }
}

class PropagateRequestId implements HttpService {
    private readonly inner: HttpService;
    private readonly headerName: string;

    public constructor(inner: HttpService, headerName: string) {
        this.inner = inner;
        this.headerName = headerName;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const response = await this.inner.invoke(req);
        const requestRequestId = req.headers.get(this.headerName);
        const responseRequestId = response.headers.get(this.headerName);

        if (responseRequestId) {
            if (!response.extensions.has(REQUEST_ID)) {
                response.extensions.insert(REQUEST_ID, responseRequestId.value);
            }
        } else if (requestRequestId) {
            response.headers.insert(this.headerName, requestRequestId);
            response.extensions.insert(REQUEST_ID, requestRequestId.value);
        }

        return response;
    }
}
