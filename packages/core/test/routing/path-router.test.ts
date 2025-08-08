import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it, mock } from "node:test";
import { HttpRequest, jsonResponse, StatusCode } from "../../src/http/index.js";
import { m, PATH_PARAMS, PathRouter, type Service } from "../../src/routing/index.js";

const makeRequest = (path: string) => HttpRequest.builder().path(path).body(null);

describe("routing:PathRouter", () => {
    it("calls handler for a static route", async () => {
        const router = new PathRouter();
        router.route(
            "/foo",
            m.get(() => "hello"),
        );

        const res = await router.invoke(makeRequest("/foo"));
        assert.equal(res?.status.code, 200);
    });

    it("returns null if route is not found", async () => {
        const router = new PathRouter();
        router.route(
            "/foo",
            m.get(() => "hello"),
        );

        const res = await router.invoke(makeRequest("/does-not-exist"));
        assert.equal(res, null);
    });

    it("extracts path parameters", async () => {
        const router = new PathRouter();
        const methodRouter = m.get((req) => {
            const params = req.extensions.get(PATH_PARAMS);
            return jsonResponse(params);
        });

        router.route("/user/:id", methodRouter);

        const res = await router.invoke(makeRequest("/user/123"));
        assert(res);
        const json = await consumers.json(res.body.read());

        assert.deepEqual(json, { id: "123" });
    });

    it("applies layer to all routes", async () => {
        const spy = mock.fn(
            (inner: Service): Service => ({
                invoke: (req) => inner.invoke(req),
            }),
        );
        const router = new PathRouter();
        router.route(
            "/a",
            m.get(() => "hello"),
        );
        router.layer({ layer: spy });

        const res = await router.invoke(makeRequest("/a"));
        assert.equal(res?.status.code, 200);
        assert.equal(spy.mock.callCount(), 2);
    });

    it("nests another router under a path", async () => {
        const child = new PathRouter();
        child.route(
            "/sub",
            m.get(() => "nested"),
        );

        const root = new PathRouter();
        root.nest("/api", child);

        const res = await root.invoke(makeRequest("/api/sub"));
        assert(res);
        assert.equal(await consumers.text(res.body.read()), "nested");
    });

    it("merges routes from another PathRouter", async () => {
        const a = new PathRouter();
        a.route(
            "/foo",
            m.get(() => "foo"),
        );

        const b = new PathRouter();
        b.route(
            "/bar",
            m.get(() => "bar"),
        );

        a.merge(b);

        const res = await a.invoke(makeRequest("/bar"));
        assert(res);
        assert.equal(await consumers.text(res.body.read()), "bar");
    });

    it("uses methodNotAllowedFallback on all routes", async () => {
        const router = new PathRouter();
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
        const router = new PathRouter();

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
        const router = new PathRouter();
        const nested = new PathRouter();

        assert.throws(() => {
            router.nest("/*", nested);
        }, /Invalid route: nested routes cannot contain wildcards/);
    });

    it("throws if nesting path contains a wildcard segment in the middle", () => {
        const router = new PathRouter();
        const nested = new PathRouter();

        assert.throws(() => {
            router.nest("/foo/*/bar", nested);
        }, /Invalid route: nested routes cannot contain wildcards/);
    });

    it("correctly joins paths when prefix ends with a slash", async () => {
        const parent = new PathRouter();
        const nested = new PathRouter();

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
        const parent = new PathRouter();
        const nested = new PathRouter();

        nested.route(
            "/",
            m.get(() => "root"),
        );
        parent.nest("/foo", nested);

        const req = HttpRequest.builder().path("/foo").body(null);
        const res = await parent.invoke(req);

        assert.equal(res?.status, StatusCode.OK);
    });
});
