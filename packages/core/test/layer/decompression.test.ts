import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import zlib from "node:zlib";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import { RequestDecompressionLayer } from "../../src/layer/decompression.js";
import type { Service } from "../../src/routing/index.js";

describe("RequestDecompressionLayer", () => {
    const echoService: Service = {
        invoke: async (req: HttpRequest) => {
            return HttpResponse.builder().status(StatusCode.OK).body(req.body);
        },
    };

    it("passes through request unchanged when no content-encoding header", async () => {
        const layer = new RequestDecompressionLayer();
        const service = layer.layer(echoService);

        const req = HttpRequest.builder().body("hello");

        const res = await service.invoke(req);
        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), "hello");
    });

    it("decompresses gzip encoded request", async () => {
        const layer = new RequestDecompressionLayer();
        const service = layer.layer(echoService);

        const originalData = "hello gzip";

        const gzipBuffer = zlib.gzipSync(Buffer.from(originalData));
        const gzipStream = new PassThrough();
        gzipStream.end(gzipBuffer);

        const req = HttpRequest.builder().header("content-encoding", "gzip").body(gzipStream);
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), originalData);
    });

    it("decompresses deflate encoded request", async () => {
        const layer = new RequestDecompressionLayer();
        const service = layer.layer(echoService);

        const originalData = "hello deflate";

        const deflateBuffer = zlib.deflateSync(Buffer.from(originalData));
        const deflateStream = new PassThrough();
        deflateStream.end(deflateBuffer);

        const req = HttpRequest.builder().header("content-encoding", "deflate").body(deflateStream);
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), originalData);
    });

    it("decompresses br encoded request", async () => {
        const layer = new RequestDecompressionLayer();
        const service = layer.layer(echoService);

        const originalData = "hello brotli";

        const brBuffer = zlib.brotliCompressSync(Buffer.from(originalData));
        const brStream = new PassThrough();
        brStream.end(brBuffer);

        const req = HttpRequest.builder().header("content-encoding", "br").body(brStream);
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), originalData);
    });

    it("decompresses zstd encoded request", async () => {
        const layer = new RequestDecompressionLayer();
        const service = layer.layer(echoService);

        const originalData = "hello zstd";

        const zstdBuffer = zlib.zstdCompressSync(Buffer.from(originalData));
        const zstdStream = new PassThrough();
        zstdStream.end(zstdBuffer);

        const req = HttpRequest.builder().header("content-encoding", "zstd").body(zstdStream);
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), originalData);
    });

    it("returns 415 unsupported media type for unsupported encoding", async () => {
        const layer = new RequestDecompressionLayer().noGzip().noDeflate().noBr().noZstd();
        const service = layer.layer(echoService);

        const req = HttpRequest.builder().header("content-encoding", "gzip").body("foo");
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.UNSUPPORTED_MEDIA_TYPE.code);
        assert.equal(res.headers.get("accept-encoding"), "identity");
    });

    it("passes through request when encoding is identity", async () => {
        const layer = new RequestDecompressionLayer().noGzip();
        const service = layer.layer(echoService);

        const req = HttpRequest.builder()
            .header("content-encoding", "identity")
            .body("hello identity");
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), "hello identity");
    });

    it("passes through unsupported encoding when passThroughUnaccepted enabled", async () => {
        const layer = new RequestDecompressionLayer().noGzip().passThroughUnaccepted(true);
        const service = layer.layer(echoService);

        const req = HttpRequest.builder()
            .header("content-encoding", "gzip")
            .body("hello pass-through");
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.read()), "hello pass-through");
    });
});
