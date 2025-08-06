import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extension } from "../../src/extract/index.js";
import { ExtensionKey, HttpRequest } from "../../src/http/index.js";

describe("extract:extension", () => {
    const KEY = new ExtensionKey<string>("TestExtension");

    it("returns the extension if present (optional)", async () => {
        const req = HttpRequest.builder().extension(KEY, "value").body(null);

        const extract = extension(KEY);
        const result = await extract(req);
        assert.equal(result, "value");
    });

    it("returns undefined if extension is missing (optional)", async () => {
        const req = HttpRequest.builder().body(null);

        const extract = extension(KEY);
        const result = await extract(req);
        assert.equal(result, undefined);
    });

    it("returns the extension if present (required)", async () => {
        const req = HttpRequest.builder().extension(KEY, "required-value").body(null);

        const extract = extension(KEY, true);
        const result = await extract(req);
        assert.equal(result, "required-value");
    });

    it("throws an error if extension is missing (required)", async () => {
        const req = HttpRequest.builder().body("") as HttpRequest;

        const extract = extension(KEY, true);
        await assert.rejects(extract(req), new Error(`Missing extension: ${KEY}`));
    });
});
