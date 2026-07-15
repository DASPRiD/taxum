import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HeaderMap, type HttpRequest, HttpResponse, StatusCode } from "@taxum/core/http";
import { m, Router } from "@taxum/core/routing";
import type { HttpService } from "@taxum/core/service";
import { testClient } from "../src/index.js";

const echoService = (capture: { request?: HttpRequest }): HttpService => ({
    invoke: (req) => {
        capture.request = req;
        return HttpResponse.builder().body("ok");
    },
});

describe("request", () => {
    describe("query", () => {
        it("encodes a flat record with arrays as repeated keys", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .get("/search")
                .query({ q: "taxum", page: 2, exact: true, tag: ["a", "b"] });

            assert.equal(capture.request?.uri.search, "?q=taxum&page=2&exact=true&tag=a&tag=b");
        });

        it("merges with a query string already present in the path", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).get("/search?a=1").query({ b: "2" });

            assert.equal(capture.request?.uri.search, "?a=1&b=2");
        });

        it("merges multiple query() calls", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .get("/search")
                .query({ a: "1" })
                .query({ b: "2" });

            assert.equal(capture.request?.uri.search, "?a=1&b=2");
        });

        it("accepts a raw query string", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).get("/items").query("filter[status]=open");

            assert.equal(capture.request?.uri.searchParams.get("filter[status]"), "open");
        });

        it("accepts URLSearchParams", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .get("/items")
                .query(new URLSearchParams({ a: "1" }));

            assert.equal(capture.request?.uri.search, "?a=1");
        });
    });

    describe("paths", () => {
        it("rejects paths not starting with a single slash", () => {
            const client = testClient(echoService({}));

            assert.throws(() => client.get("users"), /must start with a single "\/"/);
            assert.throws(() => client.get("http://evil.example/x"), /must start/);
            assert.throws(() => client.get("//evil.example/x"), /must start/);
        });

        it("strips URI fragments", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).get("/page#section");

            assert.equal(capture.request?.uri.hash, "");
            assert.equal(capture.request?.uri.pathname, "/page");
        });
    });

    describe("bodies", () => {
        it("sends a JSON body with content-type and content-length", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).post("/users").json({ name: "Ben" });

            assert.ok(capture.request);
            assert.equal(capture.request.headers.get("content-type")?.value, "application/json");
            assert.equal(
                capture.request.headers.get("content-length")?.value,
                JSON.stringify({ name: "Ben" }).length.toString(),
            );
            assert.deepEqual(JSON.parse(await consumers.text(capture.request.body.readable)), {
                name: "Ben",
            });
        });

        it("sends a form body URL-encoded", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).post("/login").form({ user: "ben", id: 5 });

            assert.ok(capture.request);
            assert.equal(
                capture.request.headers.get("content-type")?.value,
                "application/x-www-form-urlencoded",
            );
            assert.equal(await consumers.text(capture.request.body.readable), "user=ben&id=5");
        });

        it("lets an explicit content-type win over the implied one", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .post("/users")
                .header("content-type", "application/vnd.custom+json")
                .json({});

            assert.equal(
                capture.request?.headers.get("content-type")?.value,
                "application/vnd.custom+json",
            );
        });

        it("sets content-length in bytes, not code units, for multibyte bodies", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).post("/").body("héllo");

            assert.equal(capture.request?.headers.get("content-length")?.value, "6");
        });

        it("implies no content-type for raw bodies", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture)).post("/upload").body("raw");

            assert.equal(capture.request?.headers.get("content-type"), null);
        });

        it("rejects a second body at runtime when the unsealed builder is aliased", () => {
            const request = testClient(echoService({})).post("/");
            request.json({});

            assert.throws(() => request.body("again"), /body has already been set/);
        });

        it("rejects values that are not JSON-serializable", () => {
            assert.throws(
                () => testClient(echoService({})).post("/").json(undefined),
                /not JSON-serializable/,
            );
        });
    });

    describe("headers and cookies", () => {
        it("appends bulk headers from entries and HeaderMap", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .get("/")
                .headers([["x-a", "1"]])
                .headers(HeaderMap.from([["x-b", "2"]]));

            assert.equal(capture.request?.headers.get("x-a")?.value, "1");
            assert.equal(capture.request?.headers.get("x-b")?.value, "2");
        });

        it("joins cookies into a single cookie header", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .get("/")
                .cookie("session", "abc")
                .cookie("theme", "dark");

            assert.deepEqual(
                capture.request?.headers.getAll("cookie").map((value) => value.value),
                ["session=abc; theme=dark"],
            );
        });

        it("merges cookies with an explicit cookie header", async () => {
            const capture: { request?: HttpRequest } = {};

            await testClient(echoService(capture))
                .get("/")
                .header("cookie", "existing=1")
                .cookie("session", "abc");

            assert.deepEqual(
                capture.request?.headers.getAll("cookie").map((value) => value.value),
                ["existing=1; session=abc"],
            );
        });
    });

    describe("send semantics", () => {
        it("sends exactly once for repeated awaits", async () => {
            let invocations = 0;
            const service: HttpService = {
                invoke: () => {
                    invocations++;
                    return HttpResponse.builder().body("ok");
                },
            };
            const request = testClient(service).get("/");

            const [first, second] = await Promise.all([request, request]);
            const third = await request;

            assert.equal(invocations, 1);
            assert.equal(first, second);
            assert.equal(second, third);
        });

        it("rejects mutation after send", async () => {
            const request = testClient(echoService({})).get("/");
            await request;

            assert.throws(() => request.header("x-late", "1"), /already been sent/);
        });

        it("supports finally on the request itself", async () => {
            let cleanedUp = false;

            const res = await testClient(echoService({}))
                .get("/")
                .finally(() => {
                    cleanedUp = true;
                });

            assert.equal(res.status, 200);
            assert.equal(cleanedUp, true);
        });

        it("supports catch and finally", async () => {
            const service: HttpService = {
                invoke: () => {
                    throw new Error("boom");
                },
            };
            let cleanedUp = false;

            const caught = await testClient(service)
                .get("/")
                .catch((error) => error as Error)
                .finally(() => {
                    cleanedUp = true;
                });

            assert.equal((caught as Error).message, "boom");
            assert.equal(cleanedUp, true);
        });
    });

    describe("response normalization", () => {
        it("discards HEAD bodies from non-router services", async () => {
            const service: HttpService = {
                invoke: () => HttpResponse.builder().body("hidden"),
            };

            const res = await testClient(service).head("/");

            assert.equal(await res.text(), "");
            assert.equal(res.headers.get("content-length"), null);
        });

        it("discards HEAD bodies on router fallback paths", async () => {
            const router = new Router().route(
                "/exists",
                m.get(() => "hello"),
            );

            const res = await testClient(router).head("/missing");

            assert.equal(res.status, 404);
            assert.equal(await res.text(), "");
        });

        it("swallows body cancellation failures when discarding", async () => {
            const stream = new ReadableStream<Uint8Array>({
                start: (controller) => {
                    controller.enqueue(new TextEncoder().encode("hidden"));
                },
                cancel: () => {
                    throw new Error("cancel failed");
                },
            });
            const service: HttpService = {
                invoke: () => HttpResponse.builder().body(stream),
            };

            const res = await testClient(service).head("/");

            assert.equal(await res.text(), "");
        });

        it("strips body and framing headers from 204 responses", async () => {
            const service: HttpService = {
                invoke: () =>
                    HttpResponse.builder()
                        .status(StatusCode.NO_CONTENT)
                        .header("content-length", "5")
                        .body("stale"),
            };

            const res = await testClient(service).get("/");

            assert.equal(res.status, 204);
            assert.equal(res.headers.get("content-length"), null);
            assert.equal(await res.text(), "");
        });

        it("does not invent content-length where production sends chunked", async () => {
            const service: HttpService = {
                invoke: () => HttpResponse.builder().body("hello"),
            };

            const res = await testClient(service).get("/");

            assert.equal(res.headers.get("content-length"), null);
        });

        it("keeps the content-length set by the route layer on matched routes", async () => {
            const router = new Router().route(
                "/greet",
                m.get(() => "hello"),
            );

            const res = await testClient(router).get("/greet");

            assert.equal(res.headers.get("content-length"), "5");
        });

        it("does not invent content-length on router fallback responses", async () => {
            const router = new Router().route(
                "/exists",
                m.get(() => "hello"),
            );

            const res = await testClient(router).get("/missing");

            assert.equal(res.status, 404);
            assert.equal(res.headers.get("content-length"), null);
        });
    });
});
