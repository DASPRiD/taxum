import { type HttpRequest, type ReadonlyHttpResponse, StatusCode } from "../http/index.js";
import { Fallback } from "./fallback.js";
import type { HandlerFn } from "./handler.js";
import type { Layer } from "./layer.js";
import type { MethodRouter } from "./method-router.js";
import { PathRouter } from "./path-router.js";
import { serviceFromHandler } from "./service.js";

const defaultFallbackService = serviceFromHandler(() => StatusCode.NOT_FOUND);

/**
 * The Router class is responsible for handling and routing HTTP requests based
 * on specified paths and methods.
 *
 * It allows nesting of sub-routers, adding layers, defining fallback handlers,
 * and processing requests.
 */
export class Router {
    private pathRouter = new PathRouter();
    private catchAllFallback: Fallback = new Fallback(defaultFallbackService);

    /**
     * Defines a route for a specified path and associates it with a method
     * router.
     *
     * @param path - the URL path to define the route for.
     * @param methodRouter - the router that handles the methods for the given
     *        path.
     */
    public route(path: string, methodRouter: MethodRouter): this {
        this.pathRouter.route(path, methodRouter);
        return this;
    }

    /**
     * Nests a given router under a specific path.
     *
     * @param path - the base path where the nested router will be applied.
     * @param router - the router instance to be nested under the specified
     *        path.
     */
    public nest(path: string, router: Router): this {
        this.pathRouter.nest(path, router.pathRouter);
        return this;
    }

    /**
     * Sets a fallback handler for the service.
     *
     * The specified handler will be used as a fallback to handle any requests
     * that do not match existing routes.
     *
     * @param handler - the function to be used as a fallback handler.
     */
    public fallback(handler: HandlerFn): this {
        this.catchAllFallback.service = serviceFromHandler(handler);
        return this;
    }

    /**
     * Resets the fallback handler to the default.
     */
    public resetFallback(): this {
        this.catchAllFallback.service = defaultFallbackService;
        return this;
    }

    /**
     * Applies the specified layer to all previously registered routes.
     *
     * @param layer - the layer to be applied to the endpoints.
     */
    public layer(layer: Layer): this {
        this.pathRouter.layer(layer);
        this.catchAllFallback.map(layer);
        return this;
    }

    /**
     * Makes an asynchronous HTTP call using the provided request object.
     *
     * Routes the request to the appropriate handler and returns the response.
     * If no response is returned from the primary handler, it executes the
     * fallback handler.
     *
     * This function is normally considered internal, but it can be used in
     * unit- and integration testing to avoid spinning up a server.
     *
     * @param req - the HTTP request object containing all necessary details for
     *        the call.
     */
    public async call(req: HttpRequest): Promise<ReadonlyHttpResponse> {
        let response = await this.pathRouter.call(req);

        if (!response) {
            response = await this.catchAllFallback.service(req);
        }

        return response;
    }
}
