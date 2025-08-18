import { type HttpRequest, HttpResponse, type HttpResponseLike } from "../http/index.js";
import type { HttpLayer, Layer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

/**
 * A {@link Layer} that produces {@link MapToHttpResponse} services.
 */
export class MapToHttpResponseLayer implements HttpLayer<HttpResponse, HttpResponseLike> {
    public layer(inner: HttpService<HttpResponseLike>): HttpService {
        return new MapToHttpResponse(inner);
    }
}

/**
 * A service that wraps another service and maps any {@link HttpResponseLike}
 * responses into {@link HttpResponse}s.
 */
export class MapToHttpResponse implements HttpService {
    private readonly inner: HttpService<HttpResponseLike>;

    public constructor(inner: HttpService<HttpResponseLike>) {
        this.inner = inner;
    }

    public async invoke(request: HttpRequest): Promise<HttpResponse> {
        return HttpResponse.from(await this.inner.invoke(request));
    }
}
