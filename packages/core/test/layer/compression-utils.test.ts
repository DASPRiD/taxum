import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AcceptEncoding } from "../../src/layer/compression-utils.js";

describe("layer:compression-utils", () => {
    it("has all encodings enabled by default", () => {
        const accept = new AcceptEncoding();
        assert.equal(accept.gzip(), true);
        assert.equal(accept.deflate(), true);
        assert.equal(accept.br(), true);
        assert.equal(accept.zstd(), true);
    });

    it("can disable and enable gzip encoding", () => {
        const accept = new AcceptEncoding();
        accept.setGzip(false);
        assert.equal(accept.gzip(), false);
        accept.setGzip(true);
        assert.equal(accept.gzip(), true);
    });

    it("can disable and enable deflate encoding", () => {
        const accept = new AcceptEncoding();
        accept.setDeflate(false);
        assert.equal(accept.deflate(), false);
        accept.setDeflate(true);
        assert.equal(accept.deflate(), true);
    });

    it("can disable and enable br encoding", () => {
        const accept = new AcceptEncoding();
        accept.setBr(false);
        assert.equal(accept.br(), false);
        accept.setBr(true);
        assert.equal(accept.br(), true);
    });

    it("can disable and enable zstd encoding", () => {
        const accept = new AcceptEncoding();
        accept.setZstd(false);
        assert.equal(accept.zstd(), false);
        accept.setZstd(true);
        assert.equal(accept.zstd(), true);
    });

    it("toHeaderValue returns correct encoding list", () => {
        const accept = new AcceptEncoding();
        assert.equal(accept.toHeaderValue(), "gzip,deflate,br,zstd");

        accept.setGzip(false);
        assert.equal(accept.toHeaderValue(), "deflate,br,zstd");

        accept.setDeflate(false);
        assert.equal(accept.toHeaderValue(), "br,zstd");

        accept.setBr(false);
        assert.equal(accept.toHeaderValue(), "zstd");

        accept.setZstd(false);
        assert.equal(accept.toHeaderValue(), null);
    });
});
