import { match, P } from "ts-pattern";
import { type HttpRequest, type ReadonlyHttpResponse, StatusCode } from "../http/index.js";
import { Method } from "../http/method.js";
import { Fallback } from "./fallback.js";
import type { HandlerFn } from "./handler.js";
import type { Layer } from "./layer.js";
import { MethodFilter } from "./method-filter.js";
import { type ServiceFn, serviceFromHandler } from "./service.js";

const defaultFallbackService = serviceFromHandler(() => StatusCode.METHOD_NOT_ALLOWED);

/**
 * Registers a handler function to be executed when a specified method
 * matches the provided filter.
 */
export const on = (filter: MethodFilter, handler: HandlerFn): MethodRouter => {
    return new MethodRouter().on(filter, handler);
};

/**
 * Creates a new MethodRouter instance configured with a fallback handler and
 * skips the 'Allow' header.
 */
export const any = (handler: HandlerFn): MethodRouter => {
    return new MethodRouter().fallback(handler).skipAllowHeader();
};

/**
 * Shortcut methods for creating {@link MethodRouter}s for a given method.
 */
export const m = {
    connect: (handler: HandlerFn): MethodRouter => on(MethodFilter.CONNECT, handler),
    delete: (handler: HandlerFn): MethodRouter => on(MethodFilter.DELETE, handler),
    get: (handler: HandlerFn): MethodRouter => on(MethodFilter.GET, handler),
    head: (handler: HandlerFn): MethodRouter => on(MethodFilter.HEAD, handler),
    options: (handler: HandlerFn): MethodRouter => on(MethodFilter.OPTIONS, handler),
    patch: (handler: HandlerFn): MethodRouter => on(MethodFilter.PATCH, handler),
    post: (handler: HandlerFn): MethodRouter => on(MethodFilter.POST, handler),
    put: (handler: HandlerFn): MethodRouter => on(MethodFilter.PUT, handler),
    trace: (handler: HandlerFn): MethodRouter => on(MethodFilter.TRACE, handler),
};

/**
 * Represents a router for mapping HTTP methods and their handlers to specific
 * endpoints.
 *
 * The class supports various HTTP methods and allows defining handlers for GET,
 * POST, PUT, DELETE, HEAD, OPTIONS, PATCH, TRACE, and CONNECT methods. It also
 * supports a fallback mechanism and the ability to apply middleware layers to
 * all endpoints.
 */
export class MethodRouter {
    private getEndpoint: MethodEndpoint = new MethodEndpoint();
    private headEndpoint: MethodEndpoint = new MethodEndpoint();
    private deleteEndpoint: MethodEndpoint = new MethodEndpoint();
    private optionsEndpoint: MethodEndpoint = new MethodEndpoint();
    private patchEndpoint: MethodEndpoint = new MethodEndpoint();
    private postEndpoint: MethodEndpoint = new MethodEndpoint();
    private putEndpoint: MethodEndpoint = new MethodEndpoint();
    private traceEndpoint: MethodEndpoint = new MethodEndpoint();
    private connectEndpoint: MethodEndpoint = new MethodEndpoint();
    private fallbackEndpoint: Fallback = new Fallback(defaultFallbackService);
    private allowHeader: Set<string> | null = new Set();

    private readonly ENDPOINTS: [Method, MethodEndpoint][] = [
        [Method.HEAD, this.headEndpoint],
        [Method.HEAD, this.getEndpoint],
        [Method.GET, this.getEndpoint],
        [Method.POST, this.postEndpoint],
        [Method.OPTIONS, this.optionsEndpoint],
        [Method.PATCH, this.patchEndpoint],
        [Method.PUT, this.putEndpoint],
        [Method.DELETE, this.deleteEndpoint],
        [Method.TRACE, this.traceEndpoint],
        [Method.CONNECT, this.connectEndpoint],
    ];

    /**
     * Registers a handler function for specific HTTP methods based on the
     * provided filter.
     *
     * @param filter - the filter that determines which methods the handler
     *        should be applied to.
     * @param handler - the handler function to be executed for the specified
     *        methods and filter.
     */
    public on(filter: MethodFilter, handler: HandlerFn): this {
        const service = serviceFromHandler(handler);

        this.setEndpoint(service, filter, MethodFilter.GET, this.getEndpoint, ["GET", "HEAD"]);
        this.setEndpoint(service, filter, MethodFilter.HEAD, this.headEndpoint, ["HEAD"]);
        this.setEndpoint(service, filter, MethodFilter.TRACE, this.traceEndpoint, ["TRACE"]);
        this.setEndpoint(service, filter, MethodFilter.PUT, this.putEndpoint, ["PUT"]);
        this.setEndpoint(service, filter, MethodFilter.POST, this.postEndpoint, ["POST"]);
        this.setEndpoint(service, filter, MethodFilter.PATCH, this.patchEndpoint, ["PATCH"]);
        this.setEndpoint(service, filter, MethodFilter.OPTIONS, this.optionsEndpoint, ["OPTIONS"]);
        this.setEndpoint(service, filter, MethodFilter.DELETE, this.deleteEndpoint, ["DELETE"]);
        this.setEndpoint(service, filter, MethodFilter.CONNECT, this.connectEndpoint, ["CONNECT"]);

        return this;
    }

    /**
     * Registers an HTTP CONNECT request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public connect(handler: HandlerFn): this {
        return this.on(MethodFilter.CONNECT, handler);
    }

    /**
     * Registers an HTTP DELETE request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public delete(handler: HandlerFn): this {
        return this.on(MethodFilter.DELETE, handler);
    }

    /**
     * Registers an HTTP GET request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public get(handler: HandlerFn): this {
        return this.on(MethodFilter.GET, handler);
    }

    /**
     * Registers an HTTP HEAD request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public head(handler: HandlerFn): this {
        return this.on(MethodFilter.HEAD, handler);
    }

    /**
     * Registers an HTTP OPTIONS request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public options(handler: HandlerFn): this {
        return this.on(MethodFilter.OPTIONS, handler);
    }

    /**
     * Registers an HTTP PATCH request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public patch(handler: HandlerFn): this {
        return this.on(MethodFilter.PATCH, handler);
    }

    /**
     * Registers an HTTP POST request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public post(handler: HandlerFn): this {
        return this.on(MethodFilter.POST, handler);
    }

    /**
     * Registers an HTTP PUT request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public put(handler: HandlerFn): this {
        return this.on(MethodFilter.PUT, handler);
    }

    /**
     * Registers an HTTP TRACE request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public trace(handler: HandlerFn): this {
        return this.on(MethodFilter.TRACE, handler);
    }

    /**
     * Registers a fallback handler which is called if no other method matches.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public fallback(handler: HandlerFn): this {
        this.fallbackEndpoint.service = serviceFromHandler(handler);
        return this;
    }

    /**
     * Applies the specified layer to all endpoint mappings within this router.
     *
     * @param layer - the layer to be applied to the endpoints.
     */
    public layer(layer: Layer): this {
        this.getEndpoint.map(layer);
        this.headEndpoint.map(layer);
        this.deleteEndpoint.map(layer);
        this.optionsEndpoint.map(layer);
        this.patchEndpoint.map(layer);
        this.postEndpoint.map(layer);
        this.putEndpoint.map(layer);
        this.traceEndpoint.map(layer);
        this.connectEndpoint.map(layer);
        this.fallbackEndpoint.map(layer);

        return this;
    }

    /**
     * @internal
     */
    public defaultFallback(handler: HandlerFn): void {
        if (this.fallbackEndpoint.service === defaultFallbackService) {
            this.fallbackEndpoint.service = serviceFromHandler(handler);
        }
    }

    /**
     * @internal
     */
    public skipAllowHeader(): this {
        this.allowHeader = null;
        return this;
    }

    /**
     * @internal
     */
    public async call(req: HttpRequest): Promise<ReadonlyHttpResponse> {
        for (const [method, handler] of this.ENDPOINTS) {
            const result = await this.callMethod(req, method, handler);

            if (result) {
                return result;
            }
        }

        const response = await this.fallbackEndpoint.service(req);

        if (this.allowHeader === null) {
            return response;
        }

        const responseClone = response.toOwned();
        responseClone.headers.insert("allow", this.allowHeader.values().toArray().join(","));

        return responseClone;
    }

    /**
     * @internal
     */
    public mergeForPath(path: string, other: MethodRouter): this {
        MethodRouter.mergeInner(path, "GET", this.getEndpoint, other.getEndpoint);
        MethodRouter.mergeInner(path, "HEAD", this.headEndpoint, other.headEndpoint);
        MethodRouter.mergeInner(path, "DELETE", this.deleteEndpoint, other.deleteEndpoint);
        MethodRouter.mergeInner(path, "OPTIONS", this.optionsEndpoint, other.optionsEndpoint);
        MethodRouter.mergeInner(path, "PATCH", this.patchEndpoint, other.patchEndpoint);
        MethodRouter.mergeInner(path, "POST", this.postEndpoint, other.postEndpoint);
        MethodRouter.mergeInner(path, "PUT", this.putEndpoint, other.putEndpoint);
        MethodRouter.mergeInner(path, "TRACE", this.traceEndpoint, other.traceEndpoint);
        MethodRouter.mergeInner(path, "CONNECT", this.connectEndpoint, other.connectEndpoint);

        this.fallbackEndpoint.service = match([
            this.fallbackEndpoint.service,
            other.fallbackEndpoint.service,
        ])
            .returnType<ServiceFn>()
            .with([defaultFallbackService, defaultFallbackService], () => defaultFallbackService)
            .with(
                [P.not(defaultFallbackService), defaultFallbackService],
                ([handler, _]) => handler,
            )
            .with(
                [defaultFallbackService, P.not(defaultFallbackService)],
                ([_, handler]) => handler,
            )
            .otherwise(() => {
                throw new Error("Cannot merge two `MethodRouter`s that both have a fallback");
            });

        this.allowHeader = match([this.allowHeader, other.allowHeader])
            .with([null, null], () => null)
            .with([null, P.instanceOf(Set)], ([_, value]) => value)
            .with([P.instanceOf(Set), null], ([value, _]) => value)
            .with([P.instanceOf(Set), P.instanceOf(Set)], ([a, b]) => new Set([...a, ...b]))
            .exhaustive();

        return this;
    }

    private static mergeInner(
        path: string,
        name: string,
        own: MethodEndpoint,
        other: MethodEndpoint,
    ): void {
        if (own.service !== null && other.service !== null) {
            throw new Error(
                `Overlapping method route. Handler for \`${name} ${path}\` already exists`,
            );
        }

        if (own.service === null) {
            own.service = other.service;
        }
    }

    private async callMethod(
        req: HttpRequest,
        method: Method,
        endpoint: MethodEndpoint,
    ): Promise<ReadonlyHttpResponse | null> {
        if (!req.method.equals(method) || endpoint.service === null) {
            return null;
        }

        return endpoint.service(req);
    }

    private setEndpoint(
        service: ServiceFn,
        endpointFilter: MethodFilter,
        filter: MethodFilter,
        out: MethodEndpoint,
        methods: string[],
    ): void {
        if (!endpointFilter.contains(filter)) {
            return;
        }

        out.service = service;

        if (this.allowHeader === null) {
            return;
        }

        for (const method of methods) {
            this.allowHeader.add(method);
        }
    }
}

class MethodEndpoint {
    public service: ServiceFn | null;

    public constructor(service: ServiceFn | null = null) {
        this.service = service;
    }

    public map(layer: Layer): void {
        if (this.service !== null) {
            this.service = layer.layer(this.service);
        }
    }
}
