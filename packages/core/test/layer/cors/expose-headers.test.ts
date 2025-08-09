import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExposeHeaders } from "../../../src/layer/cors/index.js";

describe("layer:cors:expose-headers", () => {
    it("default returns none (null)", () => {
        const eh = ExposeHeaders.default();
        assert(!eh.isWildcard());
        assert.equal(eh.toHeader(), null);
    });

    it("none returns null header", () => {
        const eh = ExposeHeaders.none();
        assert(!eh.isWildcard());
        assert.equal(eh.toHeader(), null);
    });

    it("any returns wildcard header", () => {
        const eh = ExposeHeaders.any();
        assert(eh.isWildcard());
        assert.deepEqual(eh.toHeader(), ["access-control-expose-headers", "*"]);
    });

    it("list returns joined headers string", () => {
        const eh = ExposeHeaders.list(["X-Custom-1", "X-Custom-2"]);
        assert(!eh.isWildcard());
        assert.deepEqual(eh.toHeader(), ["access-control-expose-headers", "X-Custom-1,X-Custom-2"]);
    });
});
