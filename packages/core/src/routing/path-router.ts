import assert from "node:assert";
import FindMyWay from "find-my-way";
import { ExtensionKey, type HttpRequest, type ReadonlyHttpResponse } from "../http/index.js";
import type { HandlerFn } from "./handler.js";
import type { Layer } from "./layer.js";
import type { MethodRouter } from "./method-router.js";

/**
 * Path parameters matched from request.
 */
export type PathParams = { [key: string]: string | undefined };

/**
 * Path parameters extension key.
 */
export const PATH_PARAMS = new ExtensionKey<PathParams>("PathParams");

/**
 * @internal
 */
export class PathRouter {
    private routes = new Map<number, MethodRouter>();
    private node = new Node();
    private prevRouteId = 0;

    /**
     * @internal
     */
    public route(path: string, methodRouter: MethodRouter): void {
        const existingRouteId = this.node.pathToRouteId.get(path);

        if (existingRouteId) {
            const prevMethodRouter = this.routes.get(existingRouteId);
            assert(
                prevMethodRouter,
                "no registered method router. This is a bug in taxum. Please file an issue",
            );

            this.routes.set(existingRouteId, prevMethodRouter.mergeForPath(path, methodRouter));
            return;
        }

        const id = this.nextRouteId();
        this.node.insert(path, id);
        this.routes.set(id, methodRouter);
    }

    /**
     * @internal
     */
    public nest(path: string, router: PathRouter): void {
        const prefix = validateNestPath(path);

        for (const [id, endpoint] of router.routes.entries()) {
            const innerPath = router.node.routeIdToPath.get(id);
            assert(innerPath, "no path for route id. This is a bug in taxum. Please file an issue");

            const path = pathForNestedRoute(prefix, innerPath);
            this.route(path, endpoint);
        }
    }

    /**
     * @internal
     */
    public layer(layer: Layer): void {
        this.routes = new Map(
            this.routes.entries().map(([id, endpoint]) => [id, endpoint.layer(layer)]),
        );
    }

    /**
     * @internal
     */
    public merge(other: PathRouter): this {
        for (const [id, route] of other.routes.entries()) {
            const path = other.node.routeIdToPath.get(id);
            assert(path, "no path for route id. This is a bug in taxum. Please file an issue");

            this.route(path, route);
        }

        return this;
    }

    /**
     * @internal
     */
    public methodNotAllowedFallback(handler: HandlerFn): void {
        for (const route of this.routes.values()) {
            route.defaultFallback(handler);
        }
    }

    /**
     * @internal
     */
    public async call(req: HttpRequest): Promise<ReadonlyHttpResponse | null> {
        const match = this.node.at(req.uri.pathname);

        if (!match) {
            return null;
        }

        req.extensions.insert(PATH_PARAMS, match.pathParams);
        const endpoint = this.routes.get(match.routeId);
        assert(endpoint, "no route for id. This is a bug in taxum. Please file an issue");

        return endpoint.call(req);
    }

    private nextRouteId(): number {
        const nextId = this.prevRouteId;
        this.prevRouteId += 1;
        return nextId;
    }
}

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

const NOOP_HANDLER = () => {
    // Noop handler for find-my-way
};
