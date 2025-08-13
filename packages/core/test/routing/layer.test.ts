import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { layerFn } from "../../src/routing/layer.js";
import type { Service } from "../../src/routing/service.js";

const makeService = (bodyText: string): Service => ({
    invoke: async () => HttpResponse.builder().body(bodyText),
});

describe("routing:layer", () => {
    it("wraps a service and calls inner invoke", async () => {
        const inner = makeService("inner-response");
        const layer = layerFn((svc) => ({
            invoke: (req) => svc.invoke(req),
        }));

        const wrapped = layer.layer(inner);
        const req = HttpRequest.builder().body(null);
        const res = await wrapped.invoke(req);

        assert.equal(await consumers.text(res.body.read()), "inner-response");
    });

    it("can modify the response from inner service", async () => {
        const inner = makeService("original");
        const layer = layerFn((svc) => ({
            invoke: async (req) => {
                const res = await svc.invoke(req);
                return HttpResponse.builder().body(
                    (await consumers.text(res.body.read())).toUpperCase(),
                );
            },
        }));

        const wrapped = layer.layer(inner);
        const req = HttpRequest.builder().body(null);
        const res = await wrapped.invoke(req);

        assert.equal(await consumers.text(res.body.read()), "ORIGINAL");
    });

    it("passes the correct inner service to LayerFn", async () => {
        let captured: Service | undefined;
        const inner = makeService("test");
        const layer = layerFn((svc) => {
            captured = svc;
            return svc;
        });

        const wrapped = layer.layer(inner);
        assert.equal(captured, inner);

        const req = HttpRequest.builder().body(null);
        const res = await wrapped.invoke(req);
        assert.equal(await consumers.text(res.body.read()), "test");
    });

    it("works with sync services", async () => {
        const syncService: Service = {
            invoke: () => HttpResponse.builder().body("sync"),
        };

        const layer = layerFn((svc) => svc);
        const wrapped = layer.layer(syncService);

        const req = HttpRequest.builder().body(null);
        const res = await wrapped.invoke(req);
        assert.equal(await consumers.text(res.body.read()), "sync");
    });
});
