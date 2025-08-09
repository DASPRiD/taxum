import { Transform } from "node:stream";
import {
    HttpRequest,
    type HttpResponse,
    LazyWrappedReadable,
    StatusCode,
    type ToHttpResponse,
} from "../http/index.js";
import type { Layer, Service } from "../routing/index.js";

/**
 * A layer that intercepts requests with body lengths greater than the
 * configured limit and converts them into `413 Payload Too Large` responses.
 *
 * @example
 * ```ts
 * import { RequestBodyLimitLayer } from "@taxum/core/layer/limit";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new RequestBodyLimitLayer(1024 * 1024));
 * ```
 */
export class RequestBodyLimitLayer implements Layer {
    private readonly limit: number;

    /**
     * Creates a new {@link RequestBodyLimitLayer}.
     *
     * @param limit - maximum size in bytes.
     */
    public constructor(limit: number) {
        this.limit = limit;
    }

    public layer(inner: Service): Service {
        return new RequestBodyLimit(inner, this.limit);
    }
}

class RequestBodyLimit implements Service {
    private readonly inner: Service;
    private readonly limit: number;

    public constructor(inner: Service, limit: number) {
        this.inner = inner;
        this.limit = limit;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const rawContentLength = req.headers.get("content-length");

        if (rawContentLength === null) {
            return this.inner.invoke(req);
        }

        const contentLength = Number.parseInt(rawContentLength, 10);

        if (!Number.isNaN(contentLength) && contentLength > this.limit) {
            return Promise.resolve(StatusCode.CONTENT_TOO_LARGE.toHttpResponse());
        }

        const limit = this.limit;
        let bytesRead = 0;

        const limitedBody = new LazyWrappedReadable(
            req.body,
            new Transform({
                transform(chunk: Buffer, _encoding, callback) {
                    bytesRead += chunk.length;

                    if (bytesRead > limit) {
                        callback(new ContentTooLargeError());
                        return;
                    }

                    callback(null, chunk);
                },
            }),
        );

        return this.inner.invoke(new HttpRequest(req.head, limitedBody, req.connectInfo));
    }
}

class ContentTooLargeError extends Error implements ToHttpResponse {
    public toHttpResponse(): HttpResponse {
        return StatusCode.CONTENT_TOO_LARGE.toHttpResponse();
    }
}
