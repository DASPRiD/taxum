import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SizeHint } from "../../src/http/index.js";

describe("http:size-hint", () => {
    describe("SizeHint", () => {
        it("creates unbounded size hint", () => {
            const hint = SizeHint.unbounded();
            assert.equal(hint.lower, 0);
            assert.equal(hint.upper, null);
            assert.equal(hint.exact(), null);
        });

        it("creates range size hint", () => {
            const hint = SizeHint.range(10, 20);
            assert.equal(hint.lower, 10);
            assert.equal(hint.upper, 20);
            assert.equal(hint.exact(), null);
        });

        it("creates exact size hint", () => {
            const hint = SizeHint.exact(15);
            assert.equal(hint.lower, 15);
            assert.equal(hint.upper, 15);
            assert.equal(hint.exact(), 15);
        });

        it("exact() returns null when lower and upper differ", () => {
            const hint = SizeHint.range(10, 20);
            assert.equal(hint.exact(), null);
        });

        it("exact() returns exact value when lower and upper are equal", () => {
            const hint = SizeHint.range(7, 7);
            assert.equal(hint.exact(), 7);
        });
    });
});
