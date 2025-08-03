import { StatusCode } from "../http/index.js";
import type { Layer } from "../routing/index.js";

/**
 * Layer that intercepts requests with body lengths greater than the
 * configured limit and converts them into `413 Payload Too Large` responses.
 */
export const requestBodyLimitLayer = (limit: number): Layer => ({
    layer: (inner) => (req) => {
        const rawContentLength = req.headers.get("content-length");

        if (rawContentLength === null) {
            return inner(req);
        }

        const contentLength = Number.parseInt(rawContentLength, 10);

        if (Number.isNaN(contentLength) || contentLength <= limit) {
            return inner(req);
        }

        return Promise.resolve(StatusCode.CONTENT_TOO_LARGE.toHttpResponse());
    },
});
