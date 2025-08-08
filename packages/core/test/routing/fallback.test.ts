import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Fallback } from "../../src/routing/index.js";
import { Route } from "../../src/routing/route.js";

describe("routing:Fallback", () => {
    it("default() stores the route and marks as default", () => {
        const route = new Route({ invoke: () => null });
        const fallback = Fallback.default(route);

        assert.strictEqual(fallback.route, route);
        assert.strictEqual(fallback.isDefault, true);
    });

    it("service() stores the route and marks as non-default", () => {
        const route = new Route({ invoke: () => null });
        const fallback = Fallback.service(route);

        assert.strictEqual(fallback.route, route);
        assert.strictEqual(fallback.isDefault, false);
    });

    it("map() applies a transformation to the route", () => {
        const originalRoute = new Route({ invoke: () => null });
        const transformedRoute = new Route({ invoke: () => null });

        const mapFn = mock.fn((_r: Route) => transformedRoute);

        const fallback = Fallback.default(originalRoute);
        const mappedFallback = fallback.map(mapFn);

        assert.strictEqual(mappedFallback.route, transformedRoute);

        assert.strictEqual(mapFn.mock.calls.length, 1);
        assert.strictEqual(mapFn.mock.calls[0].arguments[0], originalRoute);

        assert.strictEqual(mappedFallback.isDefault, fallback.isDefault);
    });
});
