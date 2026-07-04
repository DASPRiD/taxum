import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import type { Handler } from "../../src/routing/index.js";
import { Route } from "../../src/routing/route.js";

const withTimeout = async (promise: Promise<void>, ms: number, message: string): Promise<void> =>
    Promise.race([
        promise,
        delay(ms).then(() => {
            throw new Error(message);
        }),
    ]);

const makeEndlessBody = (): { stream: ReadableStream<Uint8Array>; cancellation: Promise<void> } => {
    const { promise: cancellation, resolve: cancelled } = Promise.withResolvers<void>();

    const stream = new ReadableStream<Uint8Array>({
        pull: (controller) => {
            controller.enqueue(new TextEncoder().encode("data"));
        },
        cancel: () => {
            cancelled();
        },
    });

    return { stream, cancellation };
};

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
        assert.equal(await consumers.text(res.body.readable), "hello");
    });

    it("sets Content-Length if body size is exact and header not set", async () => {
        const route = routeFrom(() => "abc");

        const req = HttpRequest.builder().body(null);
        const res = await route.invokeInner(req);

        assert.equal(res.headers.get("content-length")?.value, "3");
    });

    it("does not override existing Content-Length", async () => {
        const route = new Route({
            invoke: async () => HttpResponse.builder().header("content-length", "999").body("abc"),
        });

        const req = HttpRequest.builder().body(null);
        const res = await route.invokeInner(req);

        assert.equal(res.headers.get("content-length")?.value, "999");
    });

    it("clears body for HEAD requests", async () => {
        const route = routeFrom(() => "abc");

        const req = HttpRequest.builder().method("HEAD").body(null);
        const res = await route.invokeInner(req);

        assert.equal(await consumers.text(res.body.readable), "");
    });

    it("clears body for successful CONNECT with non-empty body", async (t) => {
        const route = routeFrom(() => "foo");
        const spy = t.mock.method(console, "error", () => {
            // Suppress console.error
        });

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "");
        assert.match(spy.mock.calls[0].arguments[0], /response to CONNECT with nonempty body/i);
    });

    it("leaves body for unsuccessful CONNECT", async () => {
        const route = routeFrom(() => [StatusCode.FORBIDDEN, "Forbidden"]);

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert(res.status.isClientError());
        assert.equal(await consumers.text(res.body.readable), "Forbidden");
    });

    it("does not clear body for successful CONNECT with empty body", async () => {
        const route = routeFrom(() => "");

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "");
    });

    it("cancels the discarded streaming body for HEAD requests", async () => {
        const { stream, cancellation } = makeEndlessBody();
        const route = new Route({
            invoke: async () => HttpResponse.builder().body(stream),
        });

        const req = HttpRequest.builder().method("HEAD").body(null);
        const res = await route.invokeInner(req);

        assert.equal(await consumers.text(res.body.readable), "");
        await withTimeout(cancellation, 500, "discarded HEAD body was not cancelled");
    });

    it("cancels the discarded streaming body for CONNECT responses", async (t) => {
        t.mock.method(console, "error", () => {
            // Suppress console.error
        });

        const { stream, cancellation } = makeEndlessBody();
        const route = new Route({
            invoke: async () => HttpResponse.builder().header("content-length", "999").body(stream),
        });

        const req = HttpRequest.builder().method("CONNECT").body(null);
        const res = await route.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "");
        await withTimeout(cancellation, 500, "discarded CONNECT body was not cancelled");
    });
});
