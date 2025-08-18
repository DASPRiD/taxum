import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it, mock } from "node:test";
import {
    HttpRequest,
    type HttpResponseLike,
    jsonResponse,
    StatusCode,
} from "../../src/http/index.js";
import type { HttpLayer } from "../../src/layer/index.js";
import { Endpoint } from "../../src/routing/endpoint.js";
import {
    m,
    NESTED_PATH,
    PATH_PARAMS,
    PathRouter,
    ROUTE_NOT_FOUND,
} from "../../src/routing/index.js";
import { Route } from "../../src/routing/route.js";
import type { HttpService } from "../../src/service/index.js";

const makeRequest = (path: string) => HttpRequest.builder().path(path).body(null);

describe("routing:PathRouter", () => {
    it("calls handler for a static route", async () => {
        const router = PathRouter.default();
        router.route(
            "/foo",
            m.get(() => "hello"),
        );

        const res = await router.invoke(makeRequest("/foo"));
        assert.equal(res?.status.code, 200);
    });

    it("throws RouteNotFound if route is not found", async () => {
        const router = PathRouter.default();
        router.route(
            "/foo",
            m.get(() => "hello"),
        );

        try {
            await router.invoke(makeRequest("/bar"));
            assert.fail("Expected RouteNotFound");
        } catch (error) {
            assert.equal(error, ROUTE_NOT_FOUND);
            return;
        }
    });

    it("extracts path parameters", async () => {
        const router = PathRouter.default();
        const methodRouter = m.get((req) => {
            const params = req.extensions.get(PATH_PARAMS);
            return jsonResponse(params ?? null);
        });

        router.route("/user/:id", methodRouter);

        const res = await router.invoke(makeRequest("/user/123"));
        assert(res);
        const json = await consumers.json(res.body.read());

        assert.deepEqual(json, { id: "123" });
    });

    it("applies layer to all routes", async () => {
        const spy = mock.fn(
            (inner: HttpService): HttpService => ({
                invoke: (req) => inner.invoke(req),
            }),
        );
        const router = PathRouter.default();
        router.route(
            "/a",
            m.get(() => "hello"),
        );
        router.layer({ layer: spy });

        const res = await router.invoke(makeRequest("/a"));
        assert.equal(res?.status.code, 200);
        assert.equal(spy.mock.callCount(), 2);
    });

    it("throws if applying route layer before adding any routes", () => {
        const router = PathRouter.default();

        const dummyLayer: HttpLayer = {
            layer: (inner) => inner,
        };

        assert.throws(() => {
            router.routeLayer(dummyLayer);
        }, /Adding a routeLayer before any routes is a no-op/);
    });

    it("applies the given route layer to all routes", async () => {
        const spy = mock.fn(
            (inner: HttpService): HttpService => ({
                invoke: (req) => inner.invoke(req),
            }),
        );

        const router = PathRouter.default();
        router.route(
            "/test",
            m.get(() => "ok"),
        );

        const layer = { layer: spy };
        const layeredRouter = router.routeLayer(layer);

        assert.notEqual(layeredRouter, router);
        const res = await layeredRouter.invoke(makeRequest("/test"));
        assert(res);
        assert.equal(res.status.code, 200);
        assert.equal(spy.mock.callCount(), 2);
    });

    it("nests another router under a path", async () => {
        const child = PathRouter.default();
        child.route(
            "/sub",
            m.get(() => "nested"),
        );

        const root = PathRouter.default();
        root.nest("/api", child);

        const res = await root.invoke(makeRequest("/api/sub"));
        assert(res);
        assert.equal(await consumers.text(res.body.read()), "nested");
    });

    it("nests routes with non-method-router endpoints", async () => {
        const leaf = PathRouter.default();

        const service: HttpService<HttpResponseLike> = {
            invoke: async () => "leaf service",
        };

        leaf.routeEndpoint("/service", Endpoint.route(new Route(service)));

        const root = PathRouter.default();
        root.nest("/api", leaf);

        const req = HttpRequest.builder().path("/api/service").body(null);
        const res = await root.invoke(req);
        assert(res);
        assert.equal(await consumers.text(res.body.read()), "leaf service");
    });

    it("merges routes from another PathRouter", async () => {
        const a = PathRouter.default();
        a.route(
            "/foo",
            m.get(() => "foo"),
        );

        const b = PathRouter.default();
        b.route(
            "/bar",
            m.get(() => "bar"),
        );

        a.merge(b);

        const res = await a.invoke(makeRequest("/bar"));
        assert(res);
        assert.equal(await consumers.text(res.body.read()), "bar");
    });

    it("merges routes with non-method-router endpoints using routeService", async () => {
        const a = PathRouter.default();
        const service = {
            invoke: async () => "service response",
        };

        a.routeEndpoint("/service", Endpoint.route(new Route(service)));

        const b = PathRouter.default();
        b.merge(a);

        const req = makeRequest("/service");
        const res = await b.invoke(req);
        assert(res);
        assert.equal(await consumers.text(res.body.read()), "service response");
    });

    it("uses methodNotAllowedFallback on all routes", async () => {
        const router = PathRouter.default();
        router.route(
            "/abc",
            m.get(() => "GET only"),
        );

        router.methodNotAllowedFallback(() => StatusCode.METHOD_NOT_ALLOWED);

        const req = HttpRequest.builder().method("POST").path("/abc").body(null);
        const res = await router.invoke(req);

        assert.equal(res?.status.code, 405);
    });

    it("merges method routers when routing the same path twice", async () => {
        const router = PathRouter.default();

        const first = m.get(() => "GET OK");
        const second = m.post(() => "POST OK");

        router.route("/merge", first);
        router.route("/merge", second);

        const getReq = HttpRequest.builder().method("GET").path("/merge").body(null);
        const getRes = await router.invoke(getReq);
        assert(getRes);
        assert.equal(await consumers.text(getRes.body.read()), "GET OK");

        const postReq = HttpRequest.builder().method("POST").path("/merge").body(null);
        const postRes = await router.invoke(postReq);
        assert(postRes);
        assert.equal(await consumers.text(postRes.body.read()), "POST OK");
    });

    it("throws if nesting path contains only a wildcard segment", () => {
        const router = PathRouter.default();
        const nested = PathRouter.default();

        assert.throws(() => {
            router.nest("/*", nested);
        }, /Invalid route: nested routes cannot contain wildcards/);
    });

    it("throws if nesting path contains a wildcard segment in the middle", () => {
        const router = PathRouter.default();
        const nested = PathRouter.default();

        assert.throws(() => {
            router.nest("/foo/*/bar", nested);
        }, /Invalid route: nested routes cannot contain wildcards/);
    });

    it("correctly joins paths when prefix ends with a slash", async () => {
        const parent = PathRouter.default();
        const nested = PathRouter.default();

        nested.route(
            "/bar",
            m.get(() => "bar"),
        );
        parent.nest("/foo/", nested);

        const req = HttpRequest.builder().path("/foo/bar").body(null);
        const res = await parent.invoke(req);

        assert.equal(res?.status, StatusCode.OK);
    });

    it("correctly joins paths when nested path is '/'", async () => {
        const parent = PathRouter.default();
        const nested = PathRouter.default();

        nested.route(
            "/",
            m.get(() => "root"),
        );
        parent.nest("/foo", nested);

        const req = HttpRequest.builder().path("/foo").body(null);
        const res = await parent.invoke(req);

        assert.equal(res?.status, StatusCode.OK);
    });

    it("nests a service at a given path with layers applied", async () => {
        const router = PathRouter.default();

        const service: HttpService<HttpResponseLike> = {
            invoke: async (req) => {
                const nestedPath = req.extensions.get(NESTED_PATH);
                return jsonResponse({ nestedPath });
            },
        };

        router.nestService("/api", service);

        // request matching the nested path prefix exactly
        let res = await router.invoke(makeRequest("/api"));
        assert(res);
        let json = await consumers.json(res.body.read());
        assert.deepEqual(json, { nestedPath: "/api" });

        // request matching a subpath of the nested path with wildcard
        res = await router.invoke(makeRequest("/api/users/123"));
        assert(res);
        json = await consumers.json(res.body.read());
        assert.deepEqual(json, { nestedPath: "/api" });

        // request matching nested path with trailing slash
        res = await router.invoke(makeRequest("/api/"));
        assert(res);
        json = await consumers.json(res.body.read());
        assert.deepEqual(json, { nestedPath: "/api" });
    });

    it("throws if nestService path contains wildcard", () => {
        const router = PathRouter.default();
        const service = { invoke: async () => jsonResponse("ok") };

        assert.throws(() => {
            router.nestService("/*", service);
        }, /Invalid route: nested routes cannot contain wildcards/);
    });

    it("supports nested path with trailing slash", async () => {
        const router = PathRouter.default();

        const service: HttpService<HttpResponseLike> = {
            invoke: async (req) => {
                return jsonResponse(req.extensions.get(NESTED_PATH) ?? null);
            },
        };

        router.nestService("/foo/", service);

        // match path with trailing slash
        let res = await router.invoke(makeRequest("/foo/"));
        assert(res);
        let json = await consumers.json(res.body.read());
        assert.equal(json, "/foo/");

        // match wildcard path under the nested prefix
        res = await router.invoke(makeRequest("/foo/bar"));
        assert(res);
        json = await consumers.json(res.body.read());
        assert.equal(json, "/foo/");
    });

    it("matches nested path without trailing slash", async () => {
        const router = PathRouter.default();

        const service: HttpService<HttpResponseLike> = {
            invoke: async (req) => jsonResponse(req.extensions.get(NESTED_PATH) ?? null),
        };

        router.nestService("/foo", service);

        // match prefix without slash
        let res = await router.invoke(makeRequest("/foo"));
        assert(res);
        let json = await consumers.json(res.body.read());
        assert.equal(json, "/foo");

        // match prefix with trailing slash
        res = await router.invoke(makeRequest("/foo/"));
        assert(res);
        json = await consumers.json(res.body.read());
        assert.equal(json, "/foo");

        // match nested wildcard route
        res = await router.invoke(makeRequest("/foo/bar"));
        assert(res);
        json = await consumers.json(res.body.read());
        assert.equal(json, "/foo");
    });

    it("concatenates NESTED_PATH when nested multiple levels deep", async () => {
        const leaf = PathRouter.default();
        leaf.route(
            "/deep",
            m.get((req) => {
                return jsonResponse(req.extensions.get(NESTED_PATH) ?? null);
            }),
        );

        const middle = PathRouter.default();
        middle.nest("/level2", leaf);

        const root = PathRouter.default();
        root.nest("/level1", middle);

        const req = HttpRequest.builder().path("/level1/level2/deep").body(null);
        const res = await root.invoke(req);
        assert(res);
        const json = await consumers.json(res.body.read());
        assert.equal(json, "/level1/level2");
    });

    it("throws if path is empty string in route()", () => {
        const router = PathRouter.default();
        assert.throws(() => {
            router.route(
                "",
                m.get(() => "hello"),
            );
        }, /Paths must start with `\/`. Use "\/" for root routes/);
    });

    it("throws if path does not start with slash in route()", () => {
        const router = PathRouter.default();
        assert.throws(() => {
            router.route(
                "no-slash",
                m.get(() => "hello"),
            );
        }, /Paths must start with `\/`/);
    });

    it("throws if path is empty string in routeEndpoint()", () => {
        const router = PathRouter.default();
        assert.throws(() => {
            router.routeEndpoint(
                "",
                Endpoint.route(new Route({ invoke: async () => jsonResponse("ok") })),
            );
        }, /Paths must start with `\/`. Use "\/" for root routes/);
    });

    it("throws if path does not start with slash in routeEndpoint()", () => {
        const router = PathRouter.default();
        assert.throws(() => {
            router.routeEndpoint(
                "invalid",
                Endpoint.route(new Route({ invoke: async () => jsonResponse("ok") })),
            );
        }, /Paths must start with `\/`/);
    });
});
