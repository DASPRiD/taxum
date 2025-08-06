import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rawQuery } from "../../src/extract/index.js";
import { HttpRequest } from "../../src/http/index.js";

describe("extract:raw-query", () => {
    it("returns URLSearchParams from the request URI", async () => {
        const url = new URL("http://localhost/users?name=Alice&age=30");
        const req = HttpRequest.builder().uri(url).body(null);

        const result = await rawQuery(req);
        assert.equal(result.get("name"), "Alice");
        assert.equal(result.get("age"), "30");
    });

    it("returns empty URLSearchParams if query is missing", async () => {
        const url = new URL("http://localhost/users");
        const req = HttpRequest.builder().uri(url).body(null);

        const result = await rawQuery(req);
        assert.equal(result.toString(), "");
    });
});
