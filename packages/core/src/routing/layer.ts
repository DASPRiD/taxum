import type { HttpResponse } from "../http/index.js";
import type { Service } from "./service.js";

/**
 * Represents a Layer that can wrap a service for adding functionality.
 */
export type Layer<T = HttpResponse, S = HttpResponse> = {
    layer: (inner: Service<S>) => Service<T>;
};

export type LayerFn<T = HttpResponse, S = HttpResponse> = (inner: Service<S>) => Service<T>;

/**
 * Returns a new {@link Layer} that wraps a service with a function.
 *
 * @example
 * ```ts
 * import { layerFn } from "@taxum/core/routing";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const layer = layerFn((inner) => new MyService(inner));
 * ```
 */
export const layerFn = <T = HttpResponse, S = HttpResponse>(f: LayerFn<T, S>): Layer<T, S> =>
    new FnLayer<T, S>(f);

class FnLayer<T = HttpResponse, S = HttpResponse> implements Layer<T, S> {
    private readonly f: LayerFn<T, S>;

    public constructor(f: LayerFn<T, S>) {
        this.f = f;
    }

    public layer(inner: Service<S>): Service<T> {
        return this.f(inner);
    }
}
