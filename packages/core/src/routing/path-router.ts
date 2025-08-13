import assert from "node:assert";
import FindMyWay from "find-my-way";
import {
    ExtensionKey,
    type HttpRequest,
    type HttpResponse,
    type HttpResponseLike,
} from "../http/index.js";
import { Endpoint } from "./endpoint.js";
import type { Handler } from "./handler.js";
import { type Layer, layerFn } from "./layer.js";
import type { MethodRouter } from "./method-router.js";
import { Route } from "./route.js";
import type { Service } from "./service.js";
import { StripPrefix } from "./strip-prefix.js";

/**
 * Path parameters matched from request.
 */
export type PathParams = { [key: string]: string | undefined };

/**
 * Path parameters extension key.
 */
export const PATH_PARAMS = new ExtensionKey<PathParams>("PathParams");

/**
 * Extension key for the nested path.
 */
export const NESTED_PATH = new ExtensionKey<string>("NestedPath");

/**
 * @internal
 */
export class PathRouter implements Service {
    private readonly routes: Map<number, Endpoint>;
    private readonly node: Node;
    private prevRouteId: number;

    private constructor(routes: Map<number, Endpoint>, node: Node, prevRouteId: number) {
        this.routes = routes;
        this.node = node;
        this.prevRouteId = prevRouteId;
    }

    public static default(): PathRouter {
        return new PathRouter(new Map(), new Node(), 0);
    }

    public route(path: string, methodRouter: MethodRouter): void {
        validatePath(path);
        const existingRouteId = this.node.pathToRouteId.get(path);

        if (existingRouteId !== undefined) {
            const prevEndpoint = this.routes.get(existingRouteId);
            assert(
                prevEndpoint,
                "no registered method router. This is a bug in taxum. Please file an issue",
            );

            if (prevEndpoint.inner.type === "method_router") {
                const prevMethodRouter = prevEndpoint.inner.router;
                this.routes.set(
                    existingRouteId,
                    Endpoint.methodRouter(prevMethodRouter.mergeForPath(path, methodRouter)),
                );
                return;
            }
        }

        const id = this.nextRouteId();
        this.node.insert(path, id);
        this.routes.set(id, Endpoint.methodRouter(methodRouter));
    }

    public routeService(path: string, service: Service): void {
        this.routeEndpoint(path, Endpoint.route(new Route(service)));
    }

    public routeEndpoint(path: string, endpoint: Endpoint): void {
        validatePath(path);

        const id = this.nextRouteId();
        this.node.insert(path, id);
        this.routes.set(id, endpoint);
    }

    public nest(pathToNestAt: string, router: PathRouter): void {
        const prefix = validateNestPath(pathToNestAt);

        for (const [id, endpoint] of router.routes.entries()) {
            const innerPath = router.node.routeIdToPath.get(id);
            assert(innerPath, "no path for route id. This is a bug in taxum. Please file an issue");

            const path = pathForNestedRoute(prefix, innerPath);
            const layers: Layer[] = [StripPrefix.layer(prefix), NestedPath.layer(pathToNestAt)];
            let layeredEndpoint = endpoint;

            for (const layer of layers) {
                layeredEndpoint = endpoint.layer(layer);
            }

            if (layeredEndpoint.inner.type === "method_router") {
                this.route(path, layeredEndpoint.inner.router);
            } else {
                this.routeEndpoint(path, Endpoint.route(layeredEndpoint.inner.route));
            }
        }
    }

    public nestService(pathToNestAt: string, service: Service<HttpResponseLike>): void {
        const path = validateNestPath(pathToNestAt);
        const prefix = path;

        const wildcardPath = path.endsWith("/") ? `${path}*` : `${path}/*`;
        const layers: Layer<HttpResponseLike, HttpResponseLike>[] = [
            StripPrefix.layer(prefix),
            NestedPath.layer(pathToNestAt),
        ];

        let layeredService = service;

        for (const layer of layers) {
            layeredService = layer.layer(service);
        }

        const endpoint = Endpoint.route(new Route(layeredService));
        this.routeEndpoint(wildcardPath, endpoint);

        // `/*` is not matched by `/`, so we need to also register a router at
        // the prefix itself. Otherwise, if you were to test at `/foo` then
        // `/foo` itself wouldn't match, which it should.
        this.routeEndpoint(prefix, endpoint);

        if (!prefix.endsWith("/")) {
            // the same goes for `/foo/`, that should also match
            this.routeEndpoint(`${prefix}/`, endpoint);
        }
    }

    public layer(layer: Layer<HttpResponseLike>): PathRouter {
        const routes = new Map(
            this.routes.entries().map(([id, endpoint]) => [id, endpoint.layer(layer)]),
        );

        return new PathRouter(routes, this.node, this.prevRouteId);
    }

    public routeLayer(layer: Layer<HttpResponseLike>): PathRouter {
        assert(
            this.routes.size > 0,
            "Adding a routeLayer before any routes is a no-op. Add the routes you want the layer to apply to first.",
        );

        return this.layer(layer);
    }

    public merge(other: PathRouter): this {
        for (const [id, route] of other.routes.entries()) {
            const path = other.node.routeIdToPath.get(id);
            assert(path, "no path for route id. This is a bug in taxum. Please file an issue");

            if (route.inner.type === "method_router") {
                this.route(path, route.inner.router);
            } else {
                this.routeService(path, route.inner.route);
            }
        }

        return this;
    }

    public methodNotAllowedFallback(handler: Handler): void {
        for (const route of this.routes.values()) {
            if (route.inner.type === "method_router") {
                route.inner.router.defaultFallback(handler);
            }
        }
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const match = this.node.at(req.uri.pathname);

        if (!match) {
            throw ROUTE_NOT_FOUND;
        }

        req.extensions.insert(PATH_PARAMS, match.pathParams);
        const endpoint = this.routes.get(match.routeId);
        assert(endpoint, "no route for id. This is a bug in taxum. Please file an issue");

        if (endpoint.inner.type === "method_router") {
            return endpoint.inner.router.invoke(req);
        }

        return endpoint.inner.route.invoke(req);
    }

    private nextRouteId(): number {
        const nextId = this.prevRouteId;
        this.prevRouteId += 1;
        return nextId;
    }
}

export const ROUTE_NOT_FOUND = Symbol("RouteNotFound");

class NestedPath<T> implements Service<T> {
    private readonly inner: Service<T>;
    private readonly path: string;

    public constructor(inner: Service<T>, path: string) {
        this.inner = inner;
        this.path = path;
    }

    public static layer<T>(path: string): Layer<T, T> {
        return layerFn((inner) => new NestedPath(inner, path));
    }

    public async invoke(req: HttpRequest): Promise<T> {
        const prev = req.extensions.get(NESTED_PATH);

        if (prev) {
            /* node:coverage ignore next */
            const newPath = prev === "/" ? this.path : `${prev.replace(/\/+$/, "")}${this.path}`;
            req.extensions.insert(NESTED_PATH, newPath);
        } else {
            req.extensions.insert(NESTED_PATH, this.path);
        }

        return this.inner.invoke(req);
    }
}

const validatePath = (path: string): void => {
    if (path.length === 0) {
        throw new Error('Paths must start with `/`. Use "/" for root routes');
    }

    if (!path.startsWith("/")) {
        throw new Error("Paths must start with `/`");
    }
};

const validateNestPath = (path: string): string => {
    assert(path.startsWith("/"));
    assert(path.length > 1);

    if (path.split("/").some((segment) => segment === "*")) {
        throw new Error("Invalid route: nested routes cannot contain wildcards (*)");
    }

    return path;
};

const pathForNestedRoute = (prefix: string, path: string): string => {
    assert(prefix.startsWith("/"));
    assert(path.startsWith("/"));

    if (prefix.endsWith("/")) {
        return `${prefix}${path.replace(/^\/+/, "")}`;
    }

    if (path === "/") {
        return prefix;
    }

    return `${prefix}${path}`;
};

class Node {
    private readonly findMyWay = FindMyWay({
        // No need to waste resources on this, we handle query strings separately
        querystringParser: () => ({}),
    });
    public readonly routeIdToPath = new Map<number, string>();
    public readonly pathToRouteId = new Map<string, number>();

    public insert(path: string, routeId: number): void {
        this.routeIdToPath.set(routeId, path);
        this.pathToRouteId.set(path, routeId);
        this.findMyWay.on("GET", path, NOOP_HANDLER, { routeId });
    }

    public at(path: string): Match | null {
        const findResult = this.findMyWay.find("GET", path);

        if (!findResult) {
            return null;
        }

        return {
            routeId: findResult.store.routeId as number,
            pathParams: findResult.params,
        };
    }
}

type Match = {
    routeId: number;
    pathParams: PathParams;
};

/* node:coverage ignore next 3 */
const NOOP_HANDLER = () => {
    // Noop handler for find-my-way
};
