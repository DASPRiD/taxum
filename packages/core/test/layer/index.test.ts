/*
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLayerLike, layerFn } from "../../src/layer/index.js";
import type { Service } from "../../src/service/index.js";

describe("layer:index", () => {
    type NumberService = Service<number, number>;

    describe("applyLayerLike", () => {
        it("applies a single layer correctly", async () => {
            const service: NumberService = {
                invoke: (req) => req + 1,
            };

            const layer = layerFn((inner: NumberService) => ({
                invoke: async (req: number) => {
                    const res = await inner.invoke(req);
                    return res * 2;
                },
            }));

            const result: number = await applyLayerLike(layer, service).invoke(3);
            assert.equal(result, 8); // (3 + 1) * 2
        });

        it("applies multiple layers correctly", async () => {
            const service: NumberService = {
                invoke: (req) => req,
            };

            const layer1 = layerFn((inner: NumberService) => ({
                invoke: async (req: number) => {
                    const res = await inner.invoke(req);
                    return res + 1;
                },
            }));

            const layer2 = layerFn((inner: NumberService) => ({
                invoke: async (req: number) => {
                    const res = await inner.invoke(req);
                    return res * 10;
                },
            }));

            const result: number = await applyLayerLike([layer1, layer2], service).invoke(2);
            assert.equal(result, 21); // ((2 * 10) + 1)
        });
    });
});
*/
