import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import type { Extractor } from "../../src/extract/index.js";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { createExtractHandler, HandlerService } from "../../src/routing/index.js";

const makeExtractor =
    <T>(value: T): Extractor<T> =>
    async () =>
        value;

describe("routing:handler", () => {
    describe("createExtractHandler", () => {
        it("calls handler with no extractors", async () => {
            const h = createExtractHandler().handler(() => HttpResponse.builder().body("ok"));

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.readable), "ok");
        });

        it("calls handler with one extractor", async () => {
            const h = createExtractHandler(makeExtractor("foo")).handler((val) =>
                HttpResponse.builder().body(val.toUpperCase()),
            );

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.readable), "FOO");
        });

        it("calls handler with multiple extractors", async () => {
            const h = createExtractHandler(makeExtractor("foo"), makeExtractor(1)).handler((a, b) =>
                HttpResponse.builder().body(`${a}-${b}`),
            );

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.readable), "foo-1");
        });

        it("supports sync extractors", async () => {
            const syncExtractor = () => 42;
            const h = createExtractHandler(syncExtractor).handler((num) =>
                HttpResponse.builder().body(num.toString()),
            );

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.readable), "42");
        });

        it("supports async handler function", async () => {
            const h = createExtractHandler(makeExtractor("a")).handler(async (val) => {
                return HttpResponse.builder().body(val.repeat(2));
            });

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.readable), "aa");
        });

        it("throws if an extractor throws", async () => {
            const failingExtractor = () => {
                throw new Error("Extractor failed");
            };
            const h = createExtractHandler(failingExtractor).handler(() =>
                HttpResponse.builder().body("never"),
            );

            const req = HttpRequest.builder().body(null);

            await assert.rejects(async () => h(req), {
                message: "Extractor failed",
            });
        });

        it("throws if handler throws", async () => {
            const h = createExtractHandler(makeExtractor("x")).handler((_) => {
                throw new Error("Handler failed");
            });

            const req = HttpRequest.builder().body(null);

            await assert.rejects(async () => h(req), {
                message: "Handler failed",
            });
        });
    });

    describe("HandlerService", () => {
        it("invokes the underlying handler and returns its response", async () => {
            const handler = async () => HttpResponse.builder().body("hello");
            const service = new HandlerService(handler);

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await service.invoke(req));

            assert.equal(await consumers.text(res.body.readable), "hello");
        });
    });
});
