import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it, mock } from "node:test";
import { HttpRequest, StatusCode } from "../../src/http/index.js";
import { any, MethodFilter, MethodRouter } from "../../src/routing/index.js";
import type { HttpService } from "../../src/service/index.js";

const METHODS = [
    ["GET", "get"],
    ["POST", "post"],
    ["PUT", "put"],
    ["PATCH", "patch"],
    ["DELETE", "delete"],
    ["OPTIONS", "options"],
    ["HEAD", "head"],
    ["TRACE", "trace"],
    ["CONNECT", "connect"],
] as const;

const makeRequest = (method = "GET") => HttpRequest.builder().method(method).body(null);

describe("routing:method-router", () => {
    for (const [method, shortcutName] of METHODS) {
        describe(`method: ${method}`, () => {
            it(`handles ${method} with .on()`, async () => {
                const router = MethodRouter.default();
                router.on(MethodFilter[method], () => null);

                const res = await router.invoke(makeRequest(method));
                assert(res.status.isSuccess());
            });

            it(`handles ${method} with shortcut method`, async () => {
                const router = MethodRouter.default();
                router[shortcutName](() => "");

                const res = await router.invoke(makeRequest(method));
                assert(res.status.isSuccess());
            });

            it(`calls fallback when ${method} handler missing`, async () => {
                const router = MethodRouter.default();
                router.fallback(() => StatusCode.METHOD_NOT_ALLOWED);

                const res = await router.invoke(makeRequest(method));
                assert.equal(res.status.code, 405);
            });

            it(`layer applies to ${method} handler`, async () => {
                const spy = mock.fn(
                    (inner: HttpService): HttpService => ({
                        invoke: (req) => inner.invoke(req),
                    }),
                );

                const router = MethodRouter.default();
                router.on(MethodFilter[method], () => null);
                router.layer({ layer: spy });

                const res = await router.invoke(makeRequest(method));
                assert(res.status.isSuccess());
                assert.equal(spy.mock.callCount(), 2);
            });
        });
    }

    it("disallows settings the same method handler twice", () => {
        const router = MethodRouter.default();
        router.on(MethodFilter.GET, () => null);

        assert.throws(() => {
            router.on(MethodFilter.GET, () => null);
        }, /Overlapping method route/);
    });

    describe("merging MethodRouters", () => {
        it("merges routers without conflicts", async () => {
            const a = MethodRouter.default();
            a.get(() => "GET from A");

            const b = MethodRouter.default();
            b.post(() => "POST from B");

            a.mergeForPath("/foo", b);

            let res = await a.invoke(makeRequest("GET"));
            assert(res);
            assert.equal(await consumers.text(res.body.readable), "GET from A");

            res = await a.invoke(makeRequest("POST"));
            assert(res);
            assert.equal(await consumers.text(res.body.readable), "POST from B");
        });

        it("throws when merging routers with conflicting handlers", () => {
            const a = MethodRouter.default();
            a.put(() => "PUT A");

            const b = MethodRouter.default();
            b.put(() => "PUT B");

            assert.throws(() => a.mergeForPath("/conflict", b), /Overlapping method route/);
        });

        it("throws if both routers have a fallback", () => {
            const r1 = MethodRouter.default().fallback(() => StatusCode.OK);
            const r2 = MethodRouter.default().fallback(() => StatusCode.CREATED);

            assert.throws(() => {
                r1.mergeForPath("/foo", r2);
            }, /Cannot merge two `MethodRouter`s that both have a fallback/);
        });
    });

    describe("skipAllowHeader behavior", () => {
        it("does not add Allow header when skipAllowHeader() called", async () => {
            const router = MethodRouter.default();
            router.get(() => "hello");
            router.skipAllowHeader();

            const res = await router.invoke(makeRequest("GET"));
            assert(!res.headers.containsKey("allow"), "Allow header should be skipped");
        });

        it("adds Allow header listing allowed methods", async () => {
            const router = MethodRouter.default();
            router.get(() => "hello");
            router.post(() => "world");

            const res = await router.invoke(makeRequest("OPTIONS"));
            const allow = res.headers.get("allow")?.value;

            assert(allow?.includes("GET"));
            assert(allow?.includes("POST"));
        });

        it("adds no Allow header when adding more methods after skip", async () => {
            const router = MethodRouter.default();
            router.skipAllowHeader();
            router.get(() => "hello");

            const res = await router.invoke(makeRequest("OPTIONS"));
            assert(!res.headers.containsKey("allow"), "Allow header should be skipped");
        });
    });

    describe("any", () => {
        it("returns a MethodRouter with the fallback handler set", async () => {
            const router = any(() => StatusCode.ACCEPTED);
            const req = HttpRequest.builder().method("GET").path("/some-path").body(null);
            const res = await router.invoke(req);

            assert(res);
            assert.equal(res.status, StatusCode.ACCEPTED);
        });

        it("skips the Allow header (allowHeader is null)", async () => {
            const router = any(() => StatusCode.OK);
            const req = HttpRequest.builder().method("GET").path("/some-path").body(null);
            const res = await router.invoke(req);

            assert(!res.headers.containsKey("allow"), "Allow header should not be present");
        });

        it("always uses fallback handler regardless of HTTP method", async () => {
            let calledWithMethod: string | null = null;

            const router = any((req) => {
                calledWithMethod = req.method.toValue();
                return StatusCode.ACCEPTED;
            });

            for (const [method] of METHODS) {
                calledWithMethod = null;
                const req = HttpRequest.builder().method(method).path("/").body(null);
                const res = await router.invoke(req);

                assert.equal(res.status, StatusCode.ACCEPTED);
                assert.equal(calledWithMethod, method);
            }
        });
    });

    describe("defaultFallback", () => {
        it("sets fallback handler only if fallback is default", async () => {
            const router = MethodRouter.default();
            const req = HttpRequest.builder().body(null);

            const res1 = await router.invoke(req);
            assert.equal(res1.status, StatusCode.METHOD_NOT_ALLOWED);

            router.defaultFallback(() => StatusCode.OK);

            const res2 = await router.invoke(req);
            assert.equal(res2.status, StatusCode.OK);
        });

        it("does not overwrite fallback handler if it's already set", async () => {
            const router = MethodRouter.default();
            router.fallback(() => StatusCode.OK);
            router.defaultFallback(() => StatusCode.IM_A_TEAPOT);

            const req = HttpRequest.builder().body(null);
            const res = await router.invoke(req);
            assert.equal(res.status, StatusCode.OK);
        });
    });
});
