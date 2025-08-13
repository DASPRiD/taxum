import { match, P } from "ts-pattern";
import {
    type HttpRequest,
    type HttpResponse,
    type HttpResponseLike,
    Method,
    StatusCode,
} from "../http/index.js";
import { Fallback } from "./fallback.js";
import { type Handler, HandlerService } from "./handler.js";
import type { Layer } from "./layer.js";
import { MethodFilter } from "./method-filter.js";
import { Route } from "./route.js";
import type { Service } from "./service.js";

const defaultFallbackRoute = new Route({
    invoke: () => StatusCode.METHOD_NOT_ALLOWED,
});

/**
 * Registers a handler function to be executed when a specified method
 * matches the provided filter.
 */
export const on = (filter: MethodFilter, handler: Handler): MethodRouter => {
    return MethodRouter.default().on(filter, handler);
};

/**
 * Creates a new MethodRouter instance configured with a fallback handler and
 * skips the 'Allow' header.
 */
export const any = (handler: Handler): MethodRouter => {
    return MethodRouter.default().fallback(handler).skipAllowHeader();
};

/**
 * Shortcut methods for creating {@link MethodRouter}s for a given method.
 */
export const m = {
    connect: (handler: Handler): MethodRouter => on(MethodFilter.CONNECT, handler),
    delete: (handler: Handler): MethodRouter => on(MethodFilter.DELETE, handler),
    get: (handler: Handler): MethodRouter => on(MethodFilter.GET, handler),
    head: (handler: Handler): MethodRouter => on(MethodFilter.HEAD, handler),
    options: (handler: Handler): MethodRouter => on(MethodFilter.OPTIONS, handler),
    patch: (handler: Handler): MethodRouter => on(MethodFilter.PATCH, handler),
    post: (handler: Handler): MethodRouter => on(MethodFilter.POST, handler),
    put: (handler: Handler): MethodRouter => on(MethodFilter.PUT, handler),
    trace: (handler: Handler): MethodRouter => on(MethodFilter.TRACE, handler),
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
export class MethodRouter implements Service {
    private getEndpoint: MethodEndpoint;
    private headEndpoint: MethodEndpoint;
    private deleteEndpoint: MethodEndpoint;
    private optionsEndpoint: MethodEndpoint;
    private patchEndpoint: MethodEndpoint;
    private postEndpoint: MethodEndpoint;
    private putEndpoint: MethodEndpoint;
    private traceEndpoint: MethodEndpoint;
    private connectEndpoint: MethodEndpoint;
    private fallbackEndpoint: Fallback;
    private allowHeader: Set<string> | null;

    private constructor(
        getEndpoint: MethodEndpoint,
        headEndpoint: MethodEndpoint,
        deleteEndpoint: MethodEndpoint,
        optionsEndpoint: MethodEndpoint,
        patchEndpoint: MethodEndpoint,
        postEndpoint: MethodEndpoint,
        putEndpoint: MethodEndpoint,
        traceEndpoint: MethodEndpoint,
        connectEndpoint: MethodEndpoint,
        fallbackEndpoint: Fallback,
        allowHeader: Set<string> | null,
    ) {
        this.getEndpoint = getEndpoint;
        this.headEndpoint = headEndpoint;
        this.deleteEndpoint = deleteEndpoint;
        this.optionsEndpoint = optionsEndpoint;
        this.patchEndpoint = patchEndpoint;
        this.postEndpoint = postEndpoint;
        this.putEndpoint = putEndpoint;
        this.traceEndpoint = traceEndpoint;
        this.connectEndpoint = connectEndpoint;
        this.fallbackEndpoint = fallbackEndpoint;
        this.allowHeader = allowHeader;
    }

    public static default(): MethodRouter {
        return new MethodRouter(
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            MethodEndpoint.NONE,
            Fallback.default(defaultFallbackRoute),
            new Set(),
        );
    }

    /**
     * Registers a handler function for specific HTTP methods based on the
     * provided filter.
     *
     * @param filter - the filter that determines which methods the handler
     *        should be applied to.
     * @param handler - the handler function to be executed for the specified
     *        methods and filter.
     */
    public on(filter: MethodFilter, handler: Handler): this {
        const route = new Route(new HandlerService(handler));

        this.getEndpoint = this.setEndpoint(
            "GET",
            route,
            filter,
            MethodFilter.GET,
            this.getEndpoint,
            ["GET", "HEAD"],
        );
        this.headEndpoint = this.setEndpoint(
            "HEAD",
            route,
            filter,
            MethodFilter.HEAD,
            this.headEndpoint,
            ["HEAD"],
        );
        this.traceEndpoint = this.setEndpoint(
            "TRACE",
            route,
            filter,
            MethodFilter.TRACE,
            this.traceEndpoint,
            ["TRACE"],
        );
        this.putEndpoint = this.setEndpoint(
            "PUT",
            route,
            filter,
            MethodFilter.PUT,
            this.putEndpoint,
            ["PUT"],
        );
        this.postEndpoint = this.setEndpoint(
            "POST",
            route,
            filter,
            MethodFilter.POST,
            this.postEndpoint,
            ["POST"],
        );
        this.patchEndpoint = this.setEndpoint(
            "PATCH",
            route,
            filter,
            MethodFilter.PATCH,
            this.patchEndpoint,
            ["PATCH"],
        );
        this.optionsEndpoint = this.setEndpoint(
            "OPTIONS",
            route,
            filter,
            MethodFilter.OPTIONS,
            this.optionsEndpoint,
            ["OPTIONS"],
        );
        this.deleteEndpoint = this.setEndpoint(
            "DELETE",
            route,
            filter,
            MethodFilter.DELETE,
            this.deleteEndpoint,
            ["DELETE"],
        );
        this.connectEndpoint = this.setEndpoint(
            "CONNECT",
            route,
            filter,
            MethodFilter.CONNECT,
            this.connectEndpoint,
            ["CONNECT"],
        );

        return this;
    }

    /**
     * Registers an HTTP CONNECT request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public connect(handler: Handler): this {
        return this.on(MethodFilter.CONNECT, handler);
    }

    /**
     * Registers an HTTP DELETE request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public delete(handler: Handler): this {
        return this.on(MethodFilter.DELETE, handler);
    }

    /**
     * Registers an HTTP GET request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public get(handler: Handler): this {
        return this.on(MethodFilter.GET, handler);
    }

    /**
     * Registers an HTTP HEAD request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public head(handler: Handler): this {
        return this.on(MethodFilter.HEAD, handler);
    }

    /**
     * Registers an HTTP OPTIONS request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public options(handler: Handler): this {
        return this.on(MethodFilter.OPTIONS, handler);
    }

    /**
     * Registers an HTTP PATCH request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public patch(handler: Handler): this {
        return this.on(MethodFilter.PATCH, handler);
    }

    /**
     * Registers an HTTP POST request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public post(handler: Handler): this {
        return this.on(MethodFilter.POST, handler);
    }

    /**
     * Registers an HTTP PUT request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public put(handler: Handler): this {
        return this.on(MethodFilter.PUT, handler);
    }

    /**
     * Registers an HTTP TRACE request handler.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public trace(handler: Handler): this {
        return this.on(MethodFilter.TRACE, handler);
    }

    /**
     * Registers a fallback handler which is called if no other method matches.
     *
     * @param handler - the handler function to be executed for this method.
     */
    public fallback(handler: Handler): this {
        this.fallbackEndpoint = Fallback.service(new Route(new HandlerService(handler)));
        return this;
    }

    /**
     * Applies the specified layer to all endpoint mappings within this router.
     *
     * @param layer - the layer to be applied to the endpoints.
     */
    public layer(layer: Layer<HttpResponseLike>): MethodRouter {
        const map = (route: Route) => route.layer(layer);

        return new MethodRouter(
            this.getEndpoint.map(map),
            this.headEndpoint.map(map),
            this.deleteEndpoint.map(map),
            this.optionsEndpoint.map(map),
            this.patchEndpoint.map(map),
            this.postEndpoint.map(map),
            this.putEndpoint.map(map),
            this.traceEndpoint.map(map),
            this.connectEndpoint.map(map),
            this.fallbackEndpoint.map(map),
            this.allowHeader,
        );
    }

    /**
     * @internal
     */
    public defaultFallback(handler: Handler): void {
        if (this.fallbackEndpoint.isDefault) {
            this.fallbackEndpoint = Fallback.service(new Route(new HandlerService(handler)));
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
    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const endpoints: [Method, MethodEndpoint][] = [
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

        for (const [method, handler] of endpoints) {
            const res = await this.invokeMethod(req, method, handler);

            if (res) {
                return res;
            }
        }

        const res = await this.fallbackEndpoint.route.invoke(req);

        if (this.allowHeader !== null) {
            res.headers.insert("allow", this.allowHeader.values().toArray().join(","));
        }

        return res;
    }

    /**
     * @internal
     */
    public mergeForPath(path: string, other: MethodRouter): this {
        this.getEndpoint = MethodRouter.mergeInner(
            path,
            "GET",
            this.getEndpoint,
            other.getEndpoint,
        );
        this.headEndpoint = MethodRouter.mergeInner(
            path,
            "HEAD",
            this.headEndpoint,
            other.headEndpoint,
        );
        this.deleteEndpoint = MethodRouter.mergeInner(
            path,
            "DELETE",
            this.deleteEndpoint,
            other.deleteEndpoint,
        );
        this.optionsEndpoint = MethodRouter.mergeInner(
            path,
            "OPTIONS",
            this.optionsEndpoint,
            other.optionsEndpoint,
        );
        this.patchEndpoint = MethodRouter.mergeInner(
            path,
            "PATCH",
            this.patchEndpoint,
            other.patchEndpoint,
        );
        this.postEndpoint = MethodRouter.mergeInner(
            path,
            "POST",
            this.postEndpoint,
            other.postEndpoint,
        );
        this.putEndpoint = MethodRouter.mergeInner(
            path,
            "PUT",
            this.putEndpoint,
            other.putEndpoint,
        );
        this.traceEndpoint = MethodRouter.mergeInner(
            path,
            "TRACE",
            this.traceEndpoint,
            other.traceEndpoint,
        );
        this.connectEndpoint = MethodRouter.mergeInner(
            path,
            "CONNECT",
            this.connectEndpoint,
            other.connectEndpoint,
        );

        this.fallbackEndpoint = match([this.fallbackEndpoint, other.fallbackEndpoint])
            .returnType<Fallback>()
            .with([{ isDefault: true }, { isDefault: true }], ([fallback, _]) => fallback)
            .with([{ isDefault: false }, { isDefault: true }], ([fallback, _]) => fallback)
            .with([{ isDefault: true }, { isDefault: false }], ([_, fallback]) => fallback)
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
    ): MethodEndpoint {
        if (own.route !== null && other.route !== null) {
            throw new Error(
                `Overlapping method route. Handler for \`${name} ${path}\` already exists`,
            );
        }

        return own.route === null ? other : own;
    }

    private async invokeMethod(
        req: HttpRequest,
        method: Method,
        endpoint: MethodEndpoint,
    ): Promise<HttpResponse | null> {
        if (!req.method.equals(method) || endpoint.route === null) {
            return null;
        }

        return endpoint.route.invokeInner(req);
    }

    private setEndpoint(
        methodName: string,
        route: Route,
        endpointFilter: MethodFilter,
        filter: MethodFilter,
        current: MethodEndpoint,
        methods: string[],
    ): MethodEndpoint {
        if (!endpointFilter.contains(filter)) {
            return current;
        }

        if (current.route !== null) {
            throw new Error(
                `Overlapping method route. Cannot add two method routes that both handle ${methodName}`,
            );
        }

        if (this.allowHeader !== null) {
            for (const method of methods) {
                this.allowHeader.add(method);
            }
        }

        return MethodEndpoint.create(route);
    }
}

class MethodEndpoint {
    public static NONE = new MethodEndpoint(null);

    public readonly route: Route | null;

    private constructor(route: Route | null = null) {
        this.route = route;
    }

    public static create(route: Route): MethodEndpoint {
        return new MethodEndpoint(route);
    }

    public map(fn: (route: Route) => Route): MethodEndpoint {
        if (this.route === null) {
            return this;
        }

        return MethodEndpoint.create(fn(this.route));
    }
}
