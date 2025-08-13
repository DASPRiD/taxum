import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import type { Service } from "../../src/routing/service.js";
import { serviceLayerFn } from "../../src/routing/service.js";

const makeService = (bodyText: string): Service => ({
    invoke: async () => HttpResponse.builder().body(bodyText),
});

describe("routing:service", () => {
    describe("serviceLayerFn", () => {
        it("passes request through to inner service", async () => {
            const inner = makeService("ok");
            const layer = serviceLayerFn(async (req, next) => next.invoke(req));

            const wrapped = layer.layer(inner);
            const req = HttpRequest.builder().body(null);
            const res = await wrapped.invoke(req);

            assert.equal(await consumers.text(res.body.read()), "ok");
        });

        it("can modify the response from inner service", async () => {
            const inner = makeService("original");
            const layer = serviceLayerFn(async (req, next) => {
                const res = await next.invoke(req);
                const text = await consumers.text(res.body.read());
                return HttpResponse.builder().body(text.toUpperCase());
            });

            const wrapped = layer.layer(inner);
            const req = HttpRequest.builder().body(null);
            const res = await wrapped.invoke(req);

            assert.equal(await consumers.text(res.body.read()), "ORIGINAL");
        });

        it("receives the correct request object", async () => {
            const inner = makeService("anything");
            let capturedReq: HttpRequest | undefined;

            const layer = serviceLayerFn((req, next) => {
                capturedReq = req;
                return next.invoke(req);
            });

            const wrapped = layer.layer(inner);
            const req = HttpRequest.builder().body("test-body");
            await wrapped.invoke(req);

            assert.equal(capturedReq, req);
        });

        it("works with sync ServiceFn", async () => {
            const inner = makeService("sync");
            const layer = serviceLayerFn(() => {
                return HttpResponse.builder().body("sync-modified");
            });

            const wrapped = layer.layer(inner);
            const req = HttpRequest.builder().body(null);
            const res = await wrapped.invoke(req);

            assert.equal(await consumers.text(res.body.read()), "sync-modified");
        });

        it("propagates errors from ServiceFn", async () => {
            const inner = makeService("ok");
            const layer = serviceLayerFn(() => {
                throw new Error("ServiceFn failed");
            });

            const wrapped = layer.layer(inner);
            const req = HttpRequest.builder().body(null);

            await assert.rejects(() => wrapped.invoke(req), {
                message: "ServiceFn failed",
            });
        });

        it("propagates errors from inner service", async () => {
            const inner: Service<HttpResponse> = {
                invoke: () => {
                    throw new Error("Inner failed");
                },
            };
            const layer = serviceLayerFn((req, next) => next.invoke(req));

            const wrapped = layer.layer(inner);
            const req = HttpRequest.builder().body(null);

            await assert.rejects(async () => wrapped.invoke(req), {
                message: "Inner failed",
            });
        });
    });
});
