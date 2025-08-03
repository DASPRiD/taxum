import {
    Body,
    type HeaderMap,
    type HttpRequest,
    HttpResponse,
    type ReadonlyHttpResponse,
    type SizeHint,
} from "../http/index.js";
import type { HandlerFn } from "./handler.js";

/**
 * Represents a service function used to handle HTTP requests and generate
 * corresponding HTTP responses.
 *
 * The function receives an {@link HttpRequest} object as input, processes it as
 * needed, and returns either a promise that resolves to a
 * {@link ReadonlyHttpResponse} or a direct {@link ReadonlyHttpResponse} object.
 */
export type ServiceFn = (
    request: HttpRequest,
) => Promise<ReadonlyHttpResponse> | ReadonlyHttpResponse;

/**
 * Transforms a request handler into a service function.
 *
 * The `serviceFromHandler` function adapts a provided handler function to
 * produce an HTTP service function. It processes incoming HTTP requests and
 * generates appropriate HTTP responses. Additionally, it enforces protocol
 * behaviors such as ensuring empty bodies for specific request methods.
 *
 * Behavior:
 * - When the request method is `CONNECT` and the response indicates success,
 *   the response body is cleared if it contains any content, ensuring
 *   compliance with HTTP protocol requirements for this method.
 * - For other request methods, the `Content-Length` header is set if
 *   applicable, based on the size hint of the response body.
 * - For the `HEAD` method, the response body is always cleared as it is not
 *   expected to contain content.
 */
export const serviceFromHandler =
    (handler: HandlerFn): ServiceFn =>
    async (req: HttpRequest) => {
        const res = HttpResponse.from(await handler(req)).toOwned();

        if (req.method === "connect" && res.status.isSuccess()) {
            if (
                res.headers.containsKey("content-length") ||
                res.headers.containsKey("transfer-encoding") ||
                res.body.sizeHint.lower !== 0
            ) {
                console.error("response to CONNECT with nonempty body");
                res.body = Body.from(null);
            }
        } else {
            setContentLength(res.headers, res.body.sizeHint);

            if (req.method === "head") {
                res.body = Body.from(null);
            }
        }

        return res;
    };

const setContentLength = (headers: HeaderMap, sizeHint: SizeHint): void => {
    if (headers.containsKey("content-length")) {
        return;
    }

    const exactSize = sizeHint.exact();

    if (!exactSize) {
        return;
    }

    headers.insert("content-length", exactSize.toString());
};
