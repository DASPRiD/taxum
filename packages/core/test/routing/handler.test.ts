import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import type { Extractor } from "../../src/extract/index.js";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { handler } from "../../src/routing/index.js";

const makeExtractor =
    <T>(value: T): Extractor<T> =>
    async () =>
        value;

describe("routing:handler", () => {
    describe("handler", () => {
        it("calls handler with no extractors", async () => {
            const h = handler([], () => HttpResponse.builder().body("ok"));

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.read()), "ok");
        });

        it("calls handler with one extractor", async () => {
            const h = handler([makeExtractor("foo")], (val: string) =>
                HttpResponse.builder().body(val.toUpperCase()),
            );

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.read()), "FOO");
        });

        it("calls handler with multiple extractors", async () => {
            const h = handler(
                [makeExtractor("foo"), makeExtractor("bar")],
                (a: string, b: string) => HttpResponse.builder().body(`${a}-${b}`),
            );

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.read()), "foo-bar");
        });

        it("supports sync extractors", async () => {
            const syncExtractor = () => 42;
            const h = handler([syncExtractor], (num: number) =>
                HttpResponse.builder().body(num.toString()),
            );

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.read()), "42");
        });

        it("supports async handler function", async () => {
            const h = handler([makeExtractor("a")], async (val: string) => {
                return HttpResponse.builder().body(val.repeat(2));
            });

            const req = HttpRequest.builder().body(null);
            const res = HttpResponse.from(await h(req));

            assert.equal(await consumers.text(res.body.read()), "aa");
        });

        it("throws if an extractor throws", async () => {
            const failingExtractor = () => {
                throw new Error("Extractor failed");
            };
            const h = handler([failingExtractor], () => HttpResponse.builder().body("never"));

            const req = HttpRequest.builder().body(null);

            await assert.rejects(async () => h(req), {
                message: "Extractor failed",
            });
        });

        it("throws if handler throws", async () => {
            const h = handler([makeExtractor("x")], () => {
                throw new Error("Handler failed");
            });

            const req = HttpRequest.builder().body(null);

            await assert.rejects(async () => h(req), {
                message: "Handler failed",
            });
        });
    });
});
