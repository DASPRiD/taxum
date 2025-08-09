import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Vary } from "../../../src/layer/cors/index.js";
import { PREFLIGHT_REQUEST_HEADERS } from "../../../src/layer/cors/support.js";

describe("layer:cors:vary", () => {
    it("default returns vary with preflight headers", () => {
        const vary = Vary.default();
        const header = vary.toHeader();
        assert(header !== null);
        assert.deepEqual(header, ["vary", PREFLIGHT_REQUEST_HEADERS.join(", ")]);
    });

    it("list returns vary with provided headers", () => {
        const headers = ["Origin", "Content-Type"];
        const vary = Vary.list(headers);
        const header = vary.toHeader();
        assert.deepEqual(header, ["vary", "Origin, Content-Type"]);
    });

    it("toHeader returns null if empty list", () => {
        const vary = Vary.list([]);
        assert.equal(vary.toHeader(), null);
    });
});
