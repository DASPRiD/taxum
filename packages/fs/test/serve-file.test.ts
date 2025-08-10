import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { HttpRequest, HttpResponse } from "@taxum/core/http";

describe("serve-file", () => {
    const newSingleFileMock = mock.fn<typeof import("../src/serve-dir.js").ServeDir.constructor>(
        () => ({
            precompressedDeflate: precompressedDeflateMock,
            precompressedGzip: precompressedGzipMock,
            precompressedBr: precompressedBrMock,
            precompressedZstd: precompressedZstdMock,
            invoke: invokeMock,
        }),
    );
    const precompressedDeflateMock =
        mock.fn<typeof import("../src/serve-dir.js").ServeDir.prototype.precompressedDeflate>();
    const precompressedGzipMock =
        mock.fn<typeof import("../src/serve-dir.js").ServeDir.prototype.precompressedGzip>();
    const precompressedBrMock =
        mock.fn<typeof import("../src/serve-dir.js").ServeDir.prototype.precompressedBr>();
    const precompressedZstdMock =
        mock.fn<typeof import("../src/serve-dir.js").ServeDir.prototype.precompressedZstd>();
    const invokeMock = mock.fn<typeof import("../src/serve-dir.js").ServeDir.prototype.invoke>();

    let ServeFile: typeof import("../src/serve-file.js").ServeFile;

    before(async () => {
        mock.module("../src/serve-dir.js", {
            namedExports: {
                ServeDir: {
                    newSingleFile: newSingleFileMock,
                },
            },
        });

        ({ ServeFile } = await import("../src/serve-file.js"));
    });

    beforeEach(() => {
        newSingleFileMock.mock.resetCalls();
        precompressedDeflateMock.mock.resetCalls();
        precompressedGzipMock.mock.resetCalls();
        precompressedBrMock.mock.resetCalls();
        precompressedZstdMock.mock.resetCalls();
        invokeMock.mock.resetCalls();
    });

    it("calls ServeDir.newSingleFile with path and default mime type", () => {
        new ServeFile("foo.txt");
        assert.equal(newSingleFileMock.mock.calls.length, 1);
        assert.equal(newSingleFileMock.mock.calls[0].arguments[0], "foo.txt");
        assert.equal(newSingleFileMock.mock.calls[0].arguments[1], "text/plain");
    });

    it("passes explicit mime type to ServeDir.newSingleFile", () => {
        new ServeFile("foo.txt", "application/x-test");
        assert.equal(newSingleFileMock.mock.calls[0].arguments[1], "application/x-test");
    });

    it("falls back to application/octet-stream", () => {
        new ServeFile("foo");
        assert.equal(newSingleFileMock.mock.calls[0].arguments[1], "application/octet-stream");
    });

    it("precompressedGzip() delegates to ServeDir.precompressedGzip()", () => {
        const f = new ServeFile("foo.txt");
        assert.equal(f.precompressedGzip(), f);
        assert.equal(precompressedGzipMock.mock.calls.length, 1);
    });

    it("precompressedBr() delegates to ServeDir.precompressedBr()", () => {
        const f = new ServeFile("foo.txt");
        assert.equal(f.precompressedBr(), f);
        assert.equal(precompressedBrMock.mock.calls.length, 1);
    });

    it("precompressedDeflate() delegates to ServeDir.precompressedDeflate()", () => {
        const f = new ServeFile("foo.txt");
        assert.equal(f.precompressedDeflate(), f);
        assert.equal(precompressedDeflateMock.mock.calls.length, 1);
    });

    it("precompressedZstd() delegates to ServeDir.precompressedZstd()", () => {
        const f = new ServeFile("foo.txt");
        assert.equal(f.precompressedZstd(), f);
        assert.equal(precompressedZstdMock.mock.calls.length, 1);
    });

    it("invoke() delegates to ServeDir.invoke()", async () => {
        const mockReq = HttpRequest.builder().body(null);
        const mockRes = HttpResponse.builder().body(null);

        invokeMock.mock.mockImplementationOnce(() => Promise.resolve(mockRes));

        const f = new ServeFile("foo.txt");
        const res = await f.invoke(mockReq);

        assert.equal(invokeMock.mock.calls.length, 1);
        assert.equal(invokeMock.mock.calls[0].arguments[0], mockReq);
        assert.equal(res, mockRes);
    });
});
