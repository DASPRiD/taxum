import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderValue } from "../../../src/http/index.js";
import { Vary } from "../../../src/middleware/cors/index.js";
import { PREFLIGHT_REQUEST_HEADERS } from "../../../src/middleware/cors/support.js";

describe("middleware:cors:vary", () => {
    it("default returns vary with preflight headers", () => {
        const vary = Vary.default();
        const header = vary.toHeader();
        assert(header !== null);
        assert.deepEqual(header, ["vary", new HeaderValue(PREFLIGHT_REQUEST_HEADERS.join(", "))]);
    });

    it("list returns vary with provided headers", () => {
        const headers = ["Origin", "Content-Type"];
        const vary = Vary.list(headers);
        const header = vary.toHeader();
        assert.deepEqual(header, ["vary", new HeaderValue("Origin, Content-Type")]);

        const fromVary = Vary.from(["Origin", "Content-Type"]);
        assert.deepEqual(fromVary, vary);
    });

    it("toHeader returns null if empty list", () => {
        const vary = Vary.list([]);
        assert.equal(vary.toHeader(), null);
    });

    it("returns original instance from from()", () => {
        const vary = Vary.default();
        assert.equal(Vary.from(vary), vary);
    });
});
