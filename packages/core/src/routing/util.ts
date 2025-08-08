import { type HttpRequest, HttpResponse, type HttpResponseLike } from "../http/index.js";
import type { Service } from "./service.js";

export class MapToHttpResponse implements Service {
    private readonly inner: Service<HttpResponseLike>;

    public constructor(inner: Service<HttpResponseLike>) {
        this.inner = inner;
    }

    public async invoke(request: HttpRequest): Promise<HttpResponse> {
        return HttpResponse.from(await this.inner.invoke(request));
    }
}
