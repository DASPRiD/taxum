import type { Layer } from "../layer/index.js";
import type { AnyService, Service } from "../service/index.js";

export type FromFnClosure<Next extends AnyService, Request, Response> = (
    req: Request,
    next: Next,
) => Promise<Response> | Response;

/**
 * Creates a layer from a function.
 *
 * @example
 * ```ts
 * import { fromFn } from "@taxum/core/middleware/from-fn";
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
export const fromFn = <Next extends AnyService, Request, Response>(
    f: FromFnClosure<Next, Request, Response>,
): FromFnLayer<Next, Request, Response> => new FromFnLayer(f);

/**
 * A layer that wraps a service with a function.
 *
 * @see {@link fromFn}
 */
export class FromFnLayer<Next extends AnyService, Request, Response>
    implements Layer<Service<Request, Response>, Next>
{
    private readonly f: FromFnClosure<Next, Request, Response>;

    /**
     * Creates a new {@link FromFnLayer}.
     */
    public constructor(f: FromFnClosure<Next, Request, Response>) {
        this.f = f;
    }

    public layer(inner: Next): Service<Request, Response> {
        return new FromFn(inner, this.f);
    }
}

class FromFn<Next extends AnyService, Request, Response> implements Service<Request, Response> {
    private readonly inner: Next;
    private readonly f: FromFnClosure<Next, Request, Response>;

    public constructor(inner: NoInfer<Next>, f: FromFnClosure<Next, Request, Response>) {
        this.inner = inner;
        this.f = f;
    }

    public async invoke(req: Request): Promise<Response> {
        return this.f(req, this.inner);
    }
}
