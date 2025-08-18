import type { HttpResponse } from "../http/index.js";
import type { AnyService, HttpService, Service } from "../service/index.js";

/**
 * Decorates a {@link Service}, transforming either the request or the response.
 *
 * Often, many of the pieces needed for writing applications can be reused
 * across components that can be applied to very different kinds of services.
 */
export type Layer<Out extends AnyService, In extends AnyService> = {
    /**
     * Wrap the given service with the middleware, returning a new service that
     * has been decorated with the middleware.
     */
    layer: (inner: In) => Out;
};

/**
 * Represents an HTTP-specific layer.
 *
 * The `HttpLayer` type represents a layer capable of processing HTTP requests
 * and returning HTTP responses. It is designed as a generic type to
 * allow for customization of incoming and outgoing responses.
 *
 * @see {@link Layer}
 */
export type HttpLayer<OutResponse = HttpResponse, InResponse = HttpResponse> = Layer<
    HttpService<OutResponse>,
    HttpService<InResponse>
>;

export type AnyLayer = Layer<AnyService, AnyService>;
export type InferOut<L extends AnyLayer> = L extends Layer<infer Out, AnyService> ? Out : never;
export type InferIn<L extends AnyLayer> = L extends Layer<AnyService, infer In> ? In : never;

export * from "./identity.js";
export * from "./layer-fn.js";
export * from "./stack.js";
export * from "./tuple.js";
