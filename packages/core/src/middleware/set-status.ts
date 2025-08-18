import type { HttpRequest, HttpResponse, StatusCode } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

/**
 * A layer that sets a specific HTTP status code to the response.
 *
 * @example
 * ```ts
 * import { StatusCode } from "@taxum/core/http";
 * import { SetStatusLayer } from "@taxum/core/middleware/set-status";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new SetStatusLayer(StatusCode.ACCEPTED));
 * ```
 */
export class SetStatusLayer implements HttpLayer {
    private readonly status: StatusCode;

    /**
     * Creates a new {@link SetStatusLayer}.
     *
     * @param status - the status to set responses to.
     */
    public constructor(status: StatusCode) {
        this.status = status;
    }

    public layer(inner: HttpService): HttpService {
        return new SetStatus(inner, this.status);
    }
}

class SetStatus implements HttpService {
    private readonly inner: HttpService;
    private readonly status: StatusCode;

    public constructor(inner: HttpService, status: StatusCode) {
        this.inner = inner;
        this.status = status;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const res = await this.inner.invoke(req);
        res.status = this.status;
        return res;
    }
}
