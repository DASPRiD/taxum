import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { fromFn } from "../../src/middleware/from-fn.js";
import type { HttpService } from "../../src/service/index.js";

describe("middleware/from-fn", () => {
    it("calls the provided function with request and next service", async () => {
        let called = false;

        const fn = async () => {
            called = true;
            return HttpResponse.builder().body("ok");
        };
        const layer = fromFn(fn);
        const innerService = { invoke: async () => HttpResponse.builder().body("inner") };
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await service.invoke(req);

        assert(called);
        assert.equal(await consumers.text(res.body.readable), "ok");
    });

    it("forwards to inner service if function calls next.invoke", async () => {
        const fn = async (req: HttpRequest, next: HttpService) => next.invoke(req);
        const layer = fromFn(fn);
        const innerService = { invoke: async () => HttpResponse.builder().body("inner") };
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await service.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "inner");
    });

    it("allows modifying the request before passing to next", async () => {
        const fn = async (req: HttpRequest, next: HttpService) => {
            req.headers.insert("x-test", "test");
            return next.invoke(req);
        };
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.equal(req.headers.get("x-test")?.value, "test");
                return HttpResponse.builder().body("ok");
            },
        };
        const layer = fromFn(fn);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await service.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "ok");
    });

    it("allows modifying the response before returning", async () => {
        const fn = async () => {
            return HttpResponse.builder().status(201).body("modified");
        };
        const innerService = {
            invoke: async () => HttpResponse.builder().body("original"),
        };
        const layer = fromFn(fn);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await service.invoke(req);

        assert.equal(res.status.code, 201);
        assert.equal(await consumers.text(res.body.readable), "modified");
    });

    it("supports synchronous functions", async () => {
        const fn = () => HttpResponse.builder().body("sync");
        const layer = fromFn(fn);
        const innerService = { invoke: async () => HttpResponse.builder().body("inner") };
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await service.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "sync");
    });

    it("throws if the function throws", async () => {
        const fn = () => {
            throw new Error("fail");
        };

        const layer = fromFn(fn);
        const innerService = { invoke: async () => HttpResponse.builder().body("inner") };
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);

        await assert.rejects(
            async () => {
                await service.invoke(req);
            },
            { message: "fail" },
        );
    });
});
