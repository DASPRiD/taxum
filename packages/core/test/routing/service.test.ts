import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import { serviceFromHandler } from "../../src/routing/index.js";

describe("routing:service", () => {
    describe("serviceFromHandler", () => {
        it("returns the response from the handler", async () => {
            const service = serviceFromHandler(() => "hello");

            const req = HttpRequest.builder().body(null);
            const res = await service(req);

            assert.equal(res.status.code, 200);
            assert.equal(await consumers.text(res.body.read()), "hello");
        });

        it("sets Content-Length if body size is exact and header not set", async () => {
            const service = serviceFromHandler(() => "abc");

            const req = HttpRequest.builder().body(null);
            const res = await service(req);

            assert.equal(res.headers.get("content-length"), "3");
        });

        it("does not override existing Content-Length", async () => {
            const handler = () =>
                HttpResponse.builder().header("content-length", "999").body("abc");
            const service = serviceFromHandler(handler);

            const req = HttpRequest.builder().body(null);
            const res = await service(req);

            assert.equal(res.headers.get("content-length"), "999");
        });

        it("clears body for HEAD requests", async () => {
            const service = serviceFromHandler(() => "abc");

            const req = HttpRequest.builder().method("HEAD").body(null);
            const res = await service(req);

            assert.equal(await consumers.text(res.body.read()), "");
        });

        it("clears body for successful CONNECT with non-empty body", async (t) => {
            const service = serviceFromHandler(() => "foo");
            const spy = t.mock.method(console, "warn", () => {
                // Suppress actual console.warn output.
            });

            const req = HttpRequest.builder().method("CONNECT").body(null);
            const res = await service(req);

            assert.equal(await consumers.text(res.body.read()), "");
            assert.match(spy.mock.calls[0].arguments[0], /response to CONNECT with nonempty body/i);
        });

        it("leaves body for unsuccessful CONNECT", async () => {
            const service = serviceFromHandler(() => StatusCode.FORBIDDEN);

            const req = HttpRequest.builder().method("CONNECT").body(null);
            const res = await service(req);

            assert(res.status.isClientError());
        });

        it("does not clear body for successful CONNECT with empty body", async () => {
            const service = serviceFromHandler(() => "");

            const req = HttpRequest.builder().method("CONNECT").body(null);
            const res = await service(req);

            assert.equal(await consumers.text(res.body.read()), "");
        });
    });
});
