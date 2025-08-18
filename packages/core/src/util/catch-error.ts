import { type HttpRequest, HttpResponse } from "../http/index.js";
import type { HttpLayer, Layer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";
import { getErrorHandler } from "./eror-handler.js";

/**
 * A {@link Layer} that produces {@link CatchError} services.
 */
export class CatchErrorLayer implements HttpLayer {
    public layer(inner: HttpService): HttpService {
        return new CatchError(inner);
    }
}

/**
 * A service that wraps another service and maps any errors occurring
 * during its invocation to an appropriate HTTP response.
 */
export class CatchError implements HttpService {
    private readonly inner: HttpService;

    public constructor(inner: HttpService) {
        this.inner = inner;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        try {
            return HttpResponse.from(await this.inner.invoke(req));
        } catch (error) {
            return getErrorHandler()(error);
        }
    }
}
