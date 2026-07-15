import assert from "node:assert/strict";
import { describe, it } from "node:test";
import zlib, { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { HeaderMap, HeaderValue, HttpResponse, StatusCode } from "@taxum/core/http";
import { TestResponse } from "../src/index.js";

describe("response", () => {
    it("wraps anything a handler may return", async () => {
        const res = TestResponse.from("hello");

        assert.equal(res.status, 200);
        assert.equal(await res.text(), "hello");
    });

    it("exposes the status as a number and the StatusCode via inner", () => {
        const res = TestResponse.from(HttpResponse.builder().status(StatusCode.CREATED).body(null));

        assert.equal(res.status, 201);
        assert.equal(res.inner.status, StatusCode.CREATED);
    });

    it("exposes headers as a native Headers snapshot", () => {
        const res = TestResponse.from(
            HttpResponse.builder().header("content-type", "text/plain").body(null),
        );

        assert.equal(res.headers.get("content-type"), "text/plain");
        assert.equal(res.headers.get("missing"), null);
    });

    it("exposes repeated set-cookie headers via getSetCookie", () => {
        const res = TestResponse.from(
            HttpResponse.builder()
                .header("set-cookie", "a=1; Path=/")
                .header("set-cookie", "b=2; Secure")
                .body(null),
        );

        assert.deepEqual(res.headers.getSetCookie(), ["a=1; Path=/", "b=2; Secure"]);
    });

    it("omits headers the native Headers type rejects, keeping them on inner", () => {
        const headers = new HeaderMap();
        headers.insert("x-evil", "line1\nline2");
        headers.insert("x-fine", "ok");

        const res = TestResponse.from(HttpResponse.builder().headers(headers).body(null));

        assert.equal(res.headers.get("x-evil"), null);
        assert.equal(res.headers.get("x-fine"), "ok");
        assert.equal(res.inner.headers.get("x-evil")?.value, "line1\nline2");
    });

    it("exposes sensitive header values, not their masked form", () => {
        const headers = new HeaderMap();
        headers.insert("authorization", new HeaderValue("Bearer secret", true));

        const res = TestResponse.from(HttpResponse.builder().headers(headers).body(null));

        assert.equal(res.headers.get("authorization"), "Bearer secret");
    });

    it("reads text and json repeatedly", async () => {
        const res = TestResponse.from(HttpResponse.builder().body(JSON.stringify({ id: "5" })));

        assert.deepEqual(await res.json(), { id: "5" });
        assert.deepEqual(await res.json<{ id: string }>(), { id: "5" });
        assert.equal(await res.text(), '{"id":"5"}');
    });

    it("reads the body as an ArrayBuffer", async () => {
        const res = TestResponse.from("abc");

        const buffer = await res.arrayBuffer();

        assert.equal(new TextDecoder().decode(buffer), "abc");
        assert.equal(await res.text(), "abc");
    });

    it("decompresses gzip bodies transparently", async () => {
        const res = TestResponse.from(
            HttpResponse.builder()
                .header("content-encoding", "gzip")
                .body(gzipSync("compressed payload")),
        );

        assert.equal(await res.text(), "compressed payload");
    });

    it("decompresses deflate bodies", async () => {
        const res = TestResponse.from(
            HttpResponse.builder()
                .header("content-encoding", "deflate")
                .body(deflateSync("deflated payload")),
        );

        assert.equal(await res.text(), "deflated payload");
    });

    it("decompresses brotli bodies", async () => {
        const res = TestResponse.from(
            HttpResponse.builder()
                .header("content-encoding", "br")
                .body(brotliCompressSync("brotli payload")),
        );

        assert.equal(await res.text(), "brotli payload");
    });

    it("decompresses zstd bodies", {
        skip: !("zstdCompressSync" in zlib) && "zstd is unavailable in this Node.js version",
    }, async () => {
        const res = TestResponse.from(
            HttpResponse.builder()
                .header("content-encoding", "zstd")
                .body(zlib.zstdCompressSync("zstd payload")),
        );

        assert.equal(await res.text(), "zstd payload");
    });

    it("decodes chained encodings in reverse application order", async () => {
        const res = TestResponse.from(
            HttpResponse.builder()
                .header("content-encoding", "deflate, gzip")
                .body(gzipSync(deflateSync("chained payload"))),
        );

        assert.equal(await res.text(), "chained payload");
    });

    it("passes identity encoding through", async () => {
        const res = TestResponse.from(
            HttpResponse.builder().header("content-encoding", "identity").body("plain"),
        );

        assert.equal(await res.text(), "plain");
    });

    it("throws on unsupported content encodings", async () => {
        const res = TestResponse.from(
            HttpResponse.builder().header("content-encoding", "bogus").body("x"),
        );

        await assert.rejects(res.text(), /Unsupported content encoding: bogus/);
    });
});
