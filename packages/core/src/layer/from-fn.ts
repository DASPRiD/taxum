import type { HttpRequest, HttpResponse } from "../http/index.js";
import type { Layer, Service } from "../routing/index.js";

export type Fn = (req: HttpRequest, next: Service) => Promise<HttpResponse> | HttpResponse;

/**
 * Creates a layer from a function.
 *
 * @example
 * ```ts
 * import { fromFn } from "@taxum/core/layer/from-fn";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(fromFn((req, next) => {
 *         // do something with `req`
 *
 *         const res = await next.invoke(req);
 *
 *         // do something with `res`
 *
 *         return res;
 *     }));
 * ```
 */
export const fromFn = (f: Fn): FromFnLayer => new FromFnLayer(f);

export class FromFnLayer implements Layer {
    private readonly f: Fn;

    /**
     * Creates a new {@link FromFnLayer}.
     *
     * @param f - a function which wraps the inner service.
     */
    public constructor(f: Fn) {
        this.f = f;
    }

    public layer(inner: Service): Service {
        return new FromFn(inner, this.f);
    }
}

class FromFn implements Service {
    private readonly inner: Service;
    private readonly f: Fn;

    public constructor(inner: Service, f: Fn) {
        this.inner = inner;
        this.f = f;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        return this.f(req, this.inner);
    }
}
