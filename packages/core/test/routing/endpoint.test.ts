import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Endpoint } from "../../src/routing/endpoint.js";
import { MethodRouter } from "../../src/routing/index.js";
import { Route } from "../../src/routing/route.js";

describe("routing:endpoint", () => {
    it("methodRouter() creates an Endpoint with type 'method_router'", () => {
        const router = MethodRouter.default();
        const ep = Endpoint.methodRouter(router);

        assert.equal(ep.inner.type, "method_router");
        assert.equal(ep.inner.router, router);
    });

    it("route() creates an Endpoint with type 'route'", () => {
        const route = new Route({ invoke: () => "test" });
        const ep = Endpoint.route(route);

        assert.equal(ep.inner.type, "route");
        assert.equal(ep.inner.route, route);
    });

    it("layer() applies layer to methodRouter inner and returns new Endpoint", () => {
        const layeredRouter = {} as MethodRouter;
        const dummyRouter = {
            layer: () => layeredRouter,
        } as unknown as MethodRouter;
        const ep = Endpoint.methodRouter(dummyRouter);

        const layeredEp = ep.layer({
            layer: (inner) => inner,
        });

        assert.equal(layeredEp.inner.type, "method_router");
        assert.equal(layeredEp.inner.router, layeredRouter);
    });

    it("layer() applies layer to route inner and returns new Endpoint", () => {
        const layeredRoute = {} as Route;
        const dummyRoute = {
            layer: () => layeredRoute,
        } as unknown as Route;
        const ep = Endpoint.route(dummyRoute);

        const layeredEp = ep.layer({
            layer: (inner) => inner,
        });

        assert.equal(layeredEp.inner.type, "route");
        assert.equal(layeredEp.inner.route, layeredRoute);
    });
});
