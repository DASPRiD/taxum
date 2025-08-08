import type { HttpRequest, HttpResponse, StatusCode } from "../http/index.js";
import type { Layer, Service } from "../routing/index.js";

/**
 * A layer that sets a specific HTTP status code to the response.
 *
 * @example
 * ```ts
 * import { StatusCode } from "@taxum/core/http";
 * import { setStatus } from "@taxum/core/layer";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new setStatus.SetStatusLayer(StatusCode.ACCEPTED));
 * ```
 */
export class SetStatusLayer implements Layer {
    private readonly status: StatusCode;

    /**
     * Creates a new {@link SetStatusLayer}.
     *
     * @param status - The status to set responses to.
     */
    public constructor(status: StatusCode) {
        this.status = status;
    }

    public layer(inner: Service): Service {
        return new SetStatus(inner, this.status);
    }
}

class SetStatus implements Service {
    private readonly inner: Service;
    private readonly status: StatusCode;

    public constructor(inner: Service, status: StatusCode) {
        this.inner = inner;
        this.status = status;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const res = await this.inner.invoke(req);
        res.status = this.status;
        return res;
    }
}
