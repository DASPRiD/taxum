import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layerFn } from "../../src/layer/index.js";
import { type Service, serviceFn } from "../../src/service/index.js";

describe("layer:layer-fn", () => {
    it("wraps a service and calls inner invoke", async () => {
        const inner = serviceFn<number, number>(() => 5);
        const layer = layerFn<Service<number, number>, Service<number, number>>((svc) => ({
            invoke: (req) => svc.invoke(req),
        }));

        const wrapped = layer.layer(inner);
        const res = await wrapped.invoke(5);

        assert.equal(res, 5);
    });

    it("can modify the response from inner service", async () => {
        const inner = serviceFn<number, number>(() => 5);
        const layer = layerFn<Service<number, number>, Service<number, number>>((svc) => ({
            invoke: async (req) => {
                const res = await svc.invoke(req);
                return res * 2;
            },
        }));

        const wrapped = layer.layer(inner);
        const res = await wrapped.invoke(5);

        assert.equal(res, 10);
    });
});
