import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Identity } from "../../src/layer/index.js";
import type { Service } from "../../src/service/index.js";

describe("layer:identity", () => {
    it("returns the same service when invoked", async () => {
        const service: Service<number, number> = { invoke: (req) => req };
        const layer = new Identity<Service<number, number>>();

        assert.equal(layer.layer(service), service);
    });
});
