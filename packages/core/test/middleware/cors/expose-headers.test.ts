import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANY, ExposeHeaders } from "../../../src/middleware/cors/index.js";

describe("middleware:cors:expose-headers", () => {
    it("default returns none (null)", () => {
        const eh = ExposeHeaders.default();
        assert(!eh.isWildcard());
        assert.equal(eh.toHeader(), null);
    });

    it("none returns null header", () => {
        const eh = ExposeHeaders.none();
        assert(!eh.isWildcard());
        assert.equal(eh.toHeader(), null);

        const fromEh = ExposeHeaders.from(null);
        assert.deepEqual(fromEh, eh);
    });

    it("any returns wildcard header", () => {
        const eh = ExposeHeaders.any();
        assert(eh.isWildcard());
        assert.deepEqual(eh.toHeader(), ["access-control-expose-headers", "*"]);

        const fromEh = ExposeHeaders.from(ANY);
        assert.deepEqual(fromEh, eh);
    });

    it("list returns joined headers string", () => {
        const eh = ExposeHeaders.list(["X-Custom-1", "X-Custom-2"]);
        assert(!eh.isWildcard());
        assert.deepEqual(eh.toHeader(), ["access-control-expose-headers", "X-Custom-1,X-Custom-2"]);

        const fromEh = ExposeHeaders.from(["X-Custom-1", "X-Custom-2"]);
        assert.deepEqual(fromEh, eh);
    });

    it("returns original instance from from()", () => {
        const eh = ExposeHeaders.default();
        assert.equal(ExposeHeaders.from(eh), eh);
    });
});
