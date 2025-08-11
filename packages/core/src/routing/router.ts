import {
    ExtensionKey,
    type HttpRequest,
    type HttpResponse,
    type HttpResponseLike,
    StatusCode,
} from "../http/index.js";
import type { setGlobalLogger } from "../logger/index.js";
import { type ErrorHandler, runWithErrorHandler } from "./eror-handler.js";
import { Fallback } from "./fallback.js";
import { type Handler, HandlerService } from "./handler.js";
import type { Layer } from "./layer.js";
import type { MethodRouter } from "./method-router.js";
import { PathRouter, ROUTE_NOT_FOUND } from "./path-router.js";
import { Route } from "./route.js";
import type { Service } from "./service.js";

const defaultFallbackRoute = new Route({
    invoke: () => StatusCode.NOT_FOUND,
});

/**
 * Extension key which holds the original URI.
 *
 * This is required as the URI within a `HttpRequest` can be mutated during
 * the request lifecycle.
 */
export const ORIGINAL_URI = new ExtensionKey("OriginalUri");

/**
 * The Router class is responsible for handling and routing HTTP requests based
 * on specified paths and methods.
 *
 * It allows nesting of sub-routers, adding layers, defining fallback handlers,
 * and processing requests.
 *
 * ## Error Handling
 *
 * Every route and service in Taxum is allowed to be fallible, as throwing
 * errors in an essential part of the application workflow. Taxum ensures that
 * errors never short-circuit the request-response cycle by wrapping each route
 * and every layered route in a `MapErrorToResponse` service.
 *
 * This means that you can safely throw errors from your routes and services,
 * and Taxum will ensure that they are handled properly. By default, Taxum will
 * convert any error into a `500 Internal Server Error` response, unless they
 * implement the `ToHttpResponse` interface, in which case they will be
 * converted to the appropriate response.
 *
 * If an error results in a `5xx` response, Taxum will log the error. Unless
 * changes, this will use the `console`. You can change the error logger by
 * calling {@link setGlobalLogger}.
 *
 * You can also change the error handler to customize the way errors are
 * converted to responses. See {@link Router.errorHandler} for more details.
 */
export class Router implements Service {
    private pathRouter = PathRouter.default();
    private catchAllFallback = Fallback.default(defaultFallbackRoute);
    private errorHandler_: ErrorHandler | null = null;

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

    public nestService(path: string, service: Service<HttpResponseLike>): this {
        this.pathRouter.nestService(path, service);
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
    public fallback(handler: Handler): this {
        this.catchAllFallback = Fallback.service(new Route(new HandlerService(handler)));
        return this;
    }

    /**
     * Resets the fallback handler to the default.
     */
    public resetFallback(): this {
        this.catchAllFallback = Fallback.default(defaultFallbackRoute);
        return this;
    }

    /**
     * Adds a fallback handler for the case where a route exists, but the method
     * of the request is not supported.
     *
     * Sets a fallback on all previously registered `MethodRouter`s to be called
     * when no matching method handler is set.
     *
     * ```ts
     * const router = new Router()
     *     .route("/", m.get(helloWorld))
     *     .fallback(handle404)
     *     .methodNotAllowedFallback(handle405);
     * ```
     *
     * The fallback only applies if there is a `MethodRouter` registered for a
     * given path, but the method used in the request is not specified. In the
     * example, a `GET` on `/` causes the `helloWorld` handler to react, while
     * issuing a `POST` triggers `handle405`. Calling an entirely different
     * route, like `/hello` causes `handle404` to run.
     */
    public methodNotAllowedFallback(handler: Handler): this {
        this.pathRouter.methodNotAllowedFallback(handler);
        return this;
    }

    /**
     * Sets the error handler to convert errors into responses.
     *
     * @see {@link ErrorHandler}
     */
    public errorHandler(errorHandler: ErrorHandler): this {
        this.errorHandler_ = errorHandler;
        return this;
    }

    /**
     * Applies the specified layer to all previously registered routes.
     *
     * @param layer - the layer to be applied to the endpoints.
     */
    public layer(layer: Layer<HttpResponse, HttpResponseLike>): this {
        this.pathRouter = this.pathRouter.layer(layer);
        this.catchAllFallback = this.catchAllFallback.map((route) => route.layer(layer));
        return this;
    }

    /**
     * Applies the specified layer to all previously registered routes.
     */
    public routeLayer(layer: Layer<HttpResponse, HttpResponseLike>): this {
        this.pathRouter = this.pathRouter.routeLayer(layer);
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
    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        req.extensions.insert(ORIGINAL_URI, new URL(req.uri));

        return runWithErrorHandler(this.errorHandler_, async () => {
            try {
                return await this.pathRouter.invoke(req);
            } catch (error) {
                if (error === ROUTE_NOT_FOUND) {
                    return await this.catchAllFallback.route.invoke(req);
                }

                /* node:coverage ignore next 2 */
                throw error;
            }
        });
    }
}
