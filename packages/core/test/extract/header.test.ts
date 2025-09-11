import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { header, MissingHeaderError } from "../../src/extract/header.js";
import { HttpRequest } from "../../src/http/index.js";

describe("extract:header", () => {
    it("returns the header if present (optional)", async () => {
        const req = HttpRequest.builder().header("foo", "value").body(null);

        const extract = header("foo");
        const result = await extract(req);
        assert.equal(result, "value");
    });

    it("returns undefined if header is missing (optional)", async () => {
        const req = HttpRequest.builder().body(null);

        const extract = header("foo");
        const result = await extract(req);
        assert.equal(result, undefined);
    });

    it("returns the header if present (required)", async () => {
        const req = HttpRequest.builder().header("foo", "required-value").body(null);

        const extract = header("foo", true);
        const result = await extract(req);
        assert.equal(result, "required-value");
    });

    it("throws an error if header is missing (required)", async () => {
        const req = HttpRequest.builder().body("") as HttpRequest;

        const extract = header("foo", true);
        await assert.rejects(extract(req), new MissingHeaderError("foo"));
    });
});
