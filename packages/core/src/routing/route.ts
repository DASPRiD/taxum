import {
    Body,
    type HeaderMap,
    type HttpRequest,
    type HttpResponse,
    type HttpResponseLike,
    Method,
    type SizeHint,
    StatusCode,
} from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import { getLoggerProxy } from "../logging/index.js";
import type { HttpService } from "../service/index.js";
import { CatchError, MapToHttpResponse } from "../util/index.js";

/**
 * @internal
 */
export class Route implements HttpService {
    private readonly inner: HttpService;

    public constructor(inner: HttpService<HttpResponseLike>) {
        this.inner = new CatchError(new MapToHttpResponse(inner));
    }

    public layer(layer: HttpLayer<HttpResponseLike>): Route {
        return new Route(layer.layer(this));
    }

    public async invokeInner(req: HttpRequest): Promise<HttpResponse> {
        return this.innerInvoke(req, true);
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        return this.innerInvoke(req, false);
    }

    private async innerInvoke(req: HttpRequest, topLevel: boolean): Promise<HttpResponse> {
        const res = await this.inner.invoke(req);

        if (req.method.equals(Method.CONNECT) && res.status.isSuccess()) {
            // From https://httpwg.org/specs/rfc9110.html#CONNECT:
            //
            // > A server MUST NOT send any Transfer-Encoding or
            // > Content-Length header fields in a 2xx (Successful)
            // > response to CONNECT.
            if (
                res.headers.containsKey("content-length") ||
                res.headers.containsKey("transfer-encoding") ||
                res.body.sizeHint.lower !== 0
            ) {
                getLoggerProxy().error("response to CONNECT with nonempty body");
                discardBody(res);
            }
        } else if (topLevel) {
            if (isBodyless(res.status)) {
                // A 1xx, 204, or 304 response must not carry a body or its framing headers
                // (RFC 9110 §8.6). Node strips the body but keeps a Content-Length we or the
                // handler set, which would advertise a length the wire never delivers.
                res.headers.remove("content-length");
                res.headers.remove("transfer-encoding");
                discardBody(res);
            } else {
                setContentLength(res.headers, res.body.sizeHint);

                if (req.method.equals(Method.HEAD)) {
                    discardBody(res);
                }
            }
        }

        return res;
    }
}

/**
 * Replaces the response body with an empty one, cancelling the discarded body's stream.
 *
 * Cancellation releases the resources held by streaming bodies (e.g. runs an async generator's
 * `finally` blocks), which JavaScript, unlike languages with destructors, doesn't do when the
 * body is simply dropped.
 */
const discardBody = (res: HttpResponse): void => {
    res.body.readable.cancel().catch(() => {
        // Errors from a discarded body are of no interest.
    });

    res.body = Body.from(null);
};

const isBodyless = (status: StatusCode): boolean =>
    status.isInformational() ||
    status.code === StatusCode.NO_CONTENT.code ||
    status.code === StatusCode.NOT_MODIFIED.code;

const setContentLength = (headers: HeaderMap, sizeHint: SizeHint): void => {
    if (headers.containsKey("content-length")) {
        return;
    }

    const exactSize = sizeHint.exact();

    if (exactSize === null) {
        return;
    }

    headers.insert("content-length", exactSize.toString());
};
