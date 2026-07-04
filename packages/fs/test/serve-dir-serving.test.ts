import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, StatusCode } from "@taxum/core/http";
import { ServeDir } from "../src/serve-dir.js";

const ASSETS = path.resolve("test/assets");
const INDEX_FILE = path.join(ASSETS, "dir-with-index", "index.html");

describe("serve-dir serving", () => {
    it("serves the appended index.html body and content-length on GET", async () => {
        const expected = await fs.readFile(INDEX_FILE);

        const service = new ServeDir(ASSETS);
        const req = HttpRequest.builder().method("GET").path("/dir-with-index/").body(null);

        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.OK);
        assert.equal(res.headers.get("content-type")?.value, "text/html");
        assert.equal(res.headers.get("content-length")?.value, String(expected.length));
        assert.equal(await consumers.text(res.body.readable), expected.toString());
    });

    it("serves the appended index.html content-length on HEAD", async () => {
        const expected = await fs.readFile(INDEX_FILE);

        const service = new ServeDir(ASSETS);
        const req = HttpRequest.builder().method("HEAD").path("/dir-with-index/").body(null);

        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.OK);
        assert.equal(res.headers.get("content-length")?.value, String(expected.length));
    });

    it("returns 404 for a malformed percent-encoded path", async () => {
        const service = new ServeDir(ASSETS);
        const req = HttpRequest.builder().method("GET").path("/%").body(null);

        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.NOT_FOUND);
    });

    it("returns 404 for a path containing an encoded NUL byte", async () => {
        const service = new ServeDir(ASSETS);
        const req = HttpRequest.builder().method("GET").path("/foo%00bar").body(null);

        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.NOT_FOUND);
    });

    it("returns 404 for a path segment exceeding the maximum filename length", async () => {
        const service = new ServeDir(ASSETS);
        const req = HttpRequest.builder()
            .method("GET")
            .path(`/${"a".repeat(5000)}`)
            .body(null);

        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.NOT_FOUND);
    });
});
