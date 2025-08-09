import {
    Body,
    type HeaderMap,
    type HttpRequest,
    type HttpResponse,
    type HttpResponseLike,
    Method,
    type SizeHint,
} from "../http/index.js";
import { getGlobalLogger } from "../logger/index.js";
import { MapErrorToResponse } from "./eror-handler.js";
import type { Layer, Service } from "./index.js";
import { MapToHttpResponse } from "./util.js";

export class Route implements Service {
    private readonly inner: Service;

    public constructor(inner: Service<HttpResponseLike>) {
        this.inner = new MapErrorToResponse(new MapToHttpResponse(inner));
    }

    public layer(layer: Layer): Route {
        return new Route(layer.layer(this.inner));
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
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
                getGlobalLogger().warn("response to CONNECT with nonempty body");
                res.body = Body.from(null);
            }
        } else {
            setContentLength(res.headers, res.body.sizeHint);

            if (req.method.equals(Method.HEAD)) {
                res.body = Body.from(null);
            }
        }

        return res;
    }
}

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
