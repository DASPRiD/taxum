import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Fallback } from "../../src/routing/index.js";
import { Route } from "../../src/routing/route.js";

describe("routing:fallback", () => {
    it("default() stores the route and marks as default", () => {
        const route = new Route({ invoke: () => null });
        const fallback = Fallback.default(route);

        assert.equal(fallback.route, route);
        assert.equal(fallback.isDefault, true);
    });

    it("service() stores the route and marks as non-default", () => {
        const route = new Route({ invoke: () => null });
        const fallback = Fallback.service(route);

        assert.equal(fallback.route, route);
        assert.equal(fallback.isDefault, false);
    });

    it("map() applies a transformation to the route", () => {
        const originalRoute = new Route({ invoke: () => null });
        const transformedRoute = new Route({ invoke: () => null });

        const map = mock.fn((_inner) => transformedRoute);

        const fallback = Fallback.default(originalRoute);
        const mappedFallback = fallback.map(map);

        assert.equal(mappedFallback.route, transformedRoute);

        assert.equal(map.mock.calls.length, 1);
        assert.equal(map.mock.calls[0].arguments[0], originalRoute);

        assert.equal(mappedFallback.isDefault, fallback.isDefault);
    });
});
