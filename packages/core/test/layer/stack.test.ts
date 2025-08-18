import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layerFn } from "../../src/layer/index.js";
import { Stack } from "../../src/layer/stack.js";
import { type Service, serviceFn } from "../../src/service/index.js";

describe("layer:stack", () => {
    it("applies inner and outer layers in correct order", async () => {
        const baseService = serviceFn<number, number>((req) => req);

        const innerLayer = layerFn<Service<number, number>, Service<number, number>>((svc) => ({
            invoke: async (req) => (await svc.invoke(req)) + 1,
        }));

        const outerLayer = layerFn<Service<number, number>, Service<number, number>>((svc) => ({
            invoke: async (req) => (await svc.invoke(req)) * 10,
        }));

        const stack = new Stack(innerLayer, outerLayer);
        const wrapped = stack.layer(baseService);

        const result = await wrapped.invoke(2);

        assert.equal(result, 30); // ((2 + 1) * 10) = 30
    });

    it("works when inner and outer are identity layers", async () => {
        const baseService = serviceFn<number, number>((req) => req);

        const identityLayer = layerFn<Service<number, number>, Service<number, number>>(
            (svc) => svc,
        );

        const stack = new Stack(identityLayer, identityLayer);
        const wrapped = stack.layer(baseService);

        const result = await wrapped.invoke(7);
        assert.equal(result, 7);
    });
});
