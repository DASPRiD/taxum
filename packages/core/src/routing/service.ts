import type { HttpRequest, HttpResponse } from "../http/index.js";
import { type Layer, layerFn } from "./layer.js";

export type Service<T = HttpResponse> = {
    invoke: (req: HttpRequest) => Promise<T> | T;
};

export type ServiceFn<T = HttpResponse, S = HttpResponse> = (
    req: HttpRequest,
    next: Service<S>,
) => Promise<T> | T;

/**
 * Returns a new {@link Layer} that wraps a service function.
 *
 * @example
 * ```ts
 * import { serviceLayerFn } from "@taxum/core/routing";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const layer = serviceLayerFn(async (req, next) => {
 *     // do something with `req`
 *
 *     const res = await next.invoke(req);
 *
 *     // do something with `res`
 *
 *     return res;
 * });
 * ```
 */
export const serviceLayerFn = <T = HttpResponse, S = HttpResponse>(
    f: ServiceFn<T, S>,
): Layer<T, S> => layerFn((inner) => new FnService(inner, f));

class FnService<T = HttpResponse, S = HttpResponse> implements Service<T> {
    private readonly inner: Service<S>;
    private readonly f: ServiceFn<T, S>;

    public constructor(inner: Service<S>, f: ServiceFn<T, S>) {
        this.inner = inner;
        this.f = f;
    }

    public async invoke(req: HttpRequest): Promise<T> {
        return this.f(req, this.inner);
    }
}
