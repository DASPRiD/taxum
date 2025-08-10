import type { HttpResponse, HttpResponseLike } from "../http/index.js";
import type { Layer } from "./layer.js";
import type { MethodRouter } from "./method-router.js";
import type { Route } from "./route.js";

type Inner =
    | {
          type: "method_router";
          router: MethodRouter;
      }
    | {
          type: "route";
          route: Route;
      };

/**
 * @internal
 */
export class Endpoint {
    public readonly inner: Inner;

    private constructor(inner: Inner) {
        this.inner = inner;
    }

    public static methodRouter(router: MethodRouter) {
        return new Endpoint({
            type: "method_router",
            router,
        });
    }

    public static route(route: Route) {
        return new Endpoint({
            type: "route",
            route,
        });
    }

    public layer(layer: Layer<HttpResponse, HttpResponseLike>): Endpoint {
        switch (this.inner.type) {
            case "method_router":
                return Endpoint.methodRouter(this.inner.router.layer(layer));

            case "route":
                return Endpoint.route(this.inner.route.layer(layer));
        }
    }
}
