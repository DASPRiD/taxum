import type { HttpResponse } from "../http/index.js";
import type { Service } from "./service.js";

/**
 * Represents a Layer that can wrap a service for adding functionality.
 */
export type Layer<S = HttpResponse, T = HttpResponse> = {
    layer: (inner: Service<S>) => Service<T>;
};

export type LayerFn<S, T> = (inner: Service<S>) => Service<T>;

/**
 * Returns a new {@link Layer} that wraps a service with a function.
 */
export const layerFn = <S, T>(f: LayerFn<S, T>): Layer<S, T> => new FnLayer<S, T>(f);

class FnLayer<S, T> implements Layer<S, T> {
    private readonly f: LayerFn<S, T>;

    public constructor(f: LayerFn<S, T>) {
        this.f = f;
    }

    public layer(inner: Service<S>): Service<T> {
        return this.f(inner);
    }
}
