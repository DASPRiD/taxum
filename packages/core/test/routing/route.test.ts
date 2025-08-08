import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import { type Handler, Route } from "../../src/routing/index.js";

describe("routing:route", () => {
    const routeFrom = (handler: Handler): Route => {
        return new Route({
            invoke: async (req) => HttpResponse.from(await handler(req)),
        });
    };

    it("returns the response from the handler", async () => {
        const route = routeFrom(() => "hello");

        const req = HttpRequest.builder().body(null);
        const res = await route.invoke(req);

        assert.equal(res.status.code, 200);
        assert.equal(await consumers.text(res.body.read()), "hello");
    });

    it("sets Content-Length if body size is exact and header not set", async () => {
        const route = routeFrom(() => "abc");

        const req = HttpRequest.builder().body(null);
        const res = await route.invoke(req);

        assert.equal(res.headers.get("content-length"), "3");
    });

    it("does not override existing Content-Length", async () => {
        const route = new Route({
            invoke: async () => HttpResponse.builder().header("content-length", "999").body("abc"),
        });

        const req = HttpRequest.builder().body(null);
        const res = await route.invoke(req);

        assert.equal(res.headers.get("content-length"), "999");
    });

    it("clears body for HEAD requests", async () => {
        const route = routeFrom(() => "abc");

        const req = HttpRequest.builder().method("HEAD").body(null);
        const res = await route.invoke(req);

        assert.equal(await consumers.text(res.body.read()), "");
    });

    it("clears body for successful CONNECT with non-empty body", async (t) => {
        const route = routeFrom(() => "foo");
        const spy = t.mock.method(console, "warn", () => {
            // Suppress console.warn
        });

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert.equal(await consumers.text(res.body.read()), "");
        assert.match(spy.mock.calls[0].arguments[0], /response to CONNECT with nonempty body/i);
    });

    it("leaves body for unsuccessful CONNECT", async () => {
        const route = routeFrom(() => [StatusCode.FORBIDDEN, "Forbidden"]);

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert(res.status.isClientError());
        assert.equal(await consumers.text(res.body.read()), "Forbidden");
    });

    it("does not clear body for successful CONNECT with empty body", async () => {
        const route = routeFrom(() => "");

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert.equal(await consumers.text(res.body.read()), "");
    });
});
