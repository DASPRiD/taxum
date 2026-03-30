import type { HttpRequest, HttpResponse } from "../http/index.js";

/**
 * A service that can be invoked with a request and returns a response.
 */
export type Service<Request, Response> = {
    /**
     * Process the request and return the response asynchronously.
     */
    invoke: (req: Request) => Promise<Response> | Response;
};

/**
 * Represents an HTTP-specific service.
 *
 * The `HttpService` type represents a service capable of processing HTTP
 * requests and returning HTTP responses. It is designed as a generic type to
 * allow for customization of the response structure.
 *
 * @see {@link Service}
 */
export type HttpService<Response = HttpResponse> = Service<HttpRequest, Response>;

// biome-ignore lint/suspicious/noExplicitAny: required for inference
export type AnyService = Service<any, any>;
export type UnknownService = Service<unknown, unknown>;
export type InferRequest<S extends AnyService> =
    // biome-ignore lint/suspicious/noExplicitAny: required for inference
    S extends Service<infer Request, any> ? Request : never;
export type InferResponse<S extends AnyService> =
    // biome-ignore lint/suspicious/noExplicitAny: required for inference
    S extends Service<any, infer Response> ? Response : never;

export * from "./service-fn.js";
