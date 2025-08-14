import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpRequest } from "@taxum/core/http";
import { cookieJar } from "../src/index.js";

describe("cookieJar extractor", () => {
    it("extracts cookies from headers", async () => {
        const req = HttpRequest.builder().header("cookie", "foo=bar; baz=qux").body(null);
        const jar = await cookieJar(req);

        assert.equal(jar.get("foo")?.value, "bar");
        assert.equal(jar.get("baz")?.value, "qux");
    });

    it("returns empty jar if no cookie header", async () => {
        const req = HttpRequest.builder().body(null);
        const jar = await cookieJar(req);

        assert.equal(jar.get("foo"), null);
    });
});
