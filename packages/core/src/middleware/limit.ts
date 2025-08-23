import { Body, HttpRequest, type HttpResponse, StatusCode } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";
import { ClientError } from "../util/index.js";

/**
 * A middleware that intercepts requests with body lengths greater than the
 * configured limit and converts them into `413 Payload Too Large` responses.
 *
 * @example
 * ```ts
 * import { RequestBodyLimitLayer } from "@taxum/core/middleware/limit";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .middleware(new RequestBodyLimitLayer(1024 * 1024));
 * ```
 */
export class RequestBodyLimitLayer implements HttpLayer {
    private readonly limit: number;

    /**
     * Creates a new {@link RequestBodyLimitLayer}.
     *
     * @param limit - maximum size in bytes.
     */
    public constructor(limit: number) {
        this.limit = limit;
    }

    public layer(inner: HttpService): HttpService {
        return new RequestBodyLimit(inner, this.limit);
    }
}

class RequestBodyLimit implements HttpService {
    private readonly inner: HttpService;
    private readonly limit: number;

    public constructor(inner: HttpService, limit: number) {
        this.inner = inner;
        this.limit = limit;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const rawContentLength = req.headers.get("content-length");

        if (rawContentLength === null) {
            return this.inner.invoke(req);
        }

        const contentLength = Number.parseInt(rawContentLength.value, 10);

        if (!Number.isNaN(contentLength) && contentLength > this.limit) {
            throw new ContentTooLargeError(this.limit);
        }

        const limit = this.limit;
        let bytesRead = 0;

        const limitedBody = new TransformStream<Uint8Array, Uint8Array>({
            transform: (chunk, controller) => {
                bytesRead += chunk.byteLength;

                if (bytesRead >= this.limit) {
                    controller.error(new ContentTooLargeError(limit));
                    return;
                }

                controller.enqueue(chunk);
            },
        });
        const readable = new Body(req.body.readable.pipeThrough(limitedBody));

        return this.inner.invoke(new HttpRequest(req.head, readable, req.connectInfo));
    }
}

export class ContentTooLargeError extends ClientError {
    public constructor(limit: number) {
        super(StatusCode.CONTENT_TOO_LARGE, `Request body is larger than ${limit} bytes`);
    }
}
