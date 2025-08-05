import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it, mock } from "node:test";
import { HttpRequest, HttpResponse, noContentResponse } from "../../src/http/index.js";
import type { ServiceFn } from "../../src/routing/index.js";
import { Fallback } from "../../src/routing/index.js";

describe("routing:fallback", () => {
    it("stores the initial service function", () => {
        const service: ServiceFn = () => noContentResponse.toHttpResponse();
        const fallback = new Fallback(service);

        assert.strictEqual(fallback.service, service);
    });

    it("applies a layer using map", async () => {
        const originalService = mock.fn<ServiceFn>(() => HttpResponse.builder().body("original"));
        const wrappedService = mock.fn<ServiceFn>(() => HttpResponse.builder().body("wrapped"));

        const layer = {
            layer: mock.fn((_inner: ServiceFn) => wrappedService),
        };

        const fallback = new Fallback(originalService);
        fallback.map(layer);

        const req = HttpRequest.builder().body(null);
        const result = await fallback.service(req);

        assert.strictEqual(await consumers.text(result.body.read()), "wrapped");
        assert.strictEqual(layer.layer.mock.calls.length, 1);
        assert.strictEqual(layer.layer.mock.calls[0].arguments[0], originalService);
        assert.strictEqual(wrappedService.mock.calls.length, 1);
        assert.strictEqual(wrappedService.mock.calls[0].arguments[0], req);
    });
});
