import type { SocketAddress } from "node:net";
import { Extensions, Method } from "@taxum/core/http";
import type { HttpService } from "@taxum/core/service";
import {
    type ResolvedTestClientOptions,
    type TestRequest,
    TestRequestBuilder,
    toSocketAddress,
} from "./request.js";

/**
 * Options for creating a {@link TestClient}.
 */
export type TestClientOptions = {
    /**
     * Base URI request paths are resolved against.
     *
     * Supplies the request URI's protocol, host, and port as well as the
     * injected `host` header, mirroring what `serve()` derives from the
     * connection and the `Host` header. A path component is ignored:
     * request paths are absolute and must start with `/`.
     *
     * Defaults to `http://localhost/`.
     */
    baseUri?: URL | string;

    /**
     * Client address stored as the `CONNECT_INFO` extension on every
     * request.
     *
     * Defaults to `127.0.0.1`.
     */
    clientIp?: string | SocketAddress;

    /**
     * Extensions inserted into every request, e.g. a fake auth context.
     *
     * The instance acts as a template: each request gets a fresh
     * {@link Extensions} populated from it, so inserts made during one
     * request don't leak into the next. The extension values themselves are
     * shared by reference across requests; prefer immutable values. Per-
     * request extensions override these.
     */
    extensions?: Extensions;
};

/**
 * An in-process test client for a taxum service.
 *
 * Requests run through `service.invoke()` without a socket, exercising the
 * full stack of routes, extractors, and layers. Everything `serve()` would
 * inject on a real connection is supplied by the client: a `host` header
 * derived from `baseUri`, the `CONNECT_INFO` extension, and inert
 * `DISCONNECT_SIGNAL` / `SHUTDOWN_SIGNAL` extensions, so handler code
 * reading them behaves as in production.
 *
 * ```ts
 * const client = testClient(router);
 * const res = await client.get("/users/5");
 *
 * assert.equal(res.status, 200);
 * assert.deepEqual(await res.json(), { id: "5" });
 * ```
 */
export class TestClient {
    private readonly service: HttpService;
    private readonly clientOptions: ResolvedTestClientOptions;

    public constructor(service: HttpService, options?: TestClientOptions) {
        this.service = service;
        this.clientOptions = {
            baseUri: new URL(options?.baseUri ?? "http://localhost/"),
            clientIp: toSocketAddress(options?.clientIp ?? "127.0.0.1"),
            extensions: options?.extensions ?? new Extensions(),
        };
    }

    /**
     * Creates a GET request for the given path.
     */
    public get(path: string): TestRequest {
        return this.request(Method.GET, path);
    }

    /**
     * Creates a POST request for the given path.
     */
    public post(path: string): TestRequest {
        return this.request(Method.POST, path);
    }

    /**
     * Creates a PUT request for the given path.
     */
    public put(path: string): TestRequest {
        return this.request(Method.PUT, path);
    }

    /**
     * Creates a PATCH request for the given path.
     */
    public patch(path: string): TestRequest {
        return this.request(Method.PATCH, path);
    }

    /**
     * Creates a DELETE request for the given path.
     */
    public delete(path: string): TestRequest {
        return this.request(Method.DELETE, path);
    }

    /**
     * Creates a HEAD request for the given path.
     */
    public head(path: string): TestRequest {
        return this.request(Method.HEAD, path);
    }

    /**
     * Creates an OPTIONS request for the given path.
     */
    public options(path: string): TestRequest {
        return this.request(Method.OPTIONS, path);
    }

    private request(method: Method, path: string): TestRequest {
        return new TestRequestBuilder(this.service, method, path, this.clientOptions);
    }
}

/**
 * Creates a new {@link TestClient} for the given service.
 */
export const testClient = (service: HttpService, options?: TestClientOptions): TestClient =>
    new TestClient(service, options);
