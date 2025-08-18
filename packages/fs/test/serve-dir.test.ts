import assert from "node:assert/strict";
import type { Stats } from "node:fs";
import type fs from "node:fs/promises";
import * as Path from "node:path";
import { Readable } from "node:stream";
import consumers from "node:stream/consumers";
import { before, beforeEach, describe, it, mock } from "node:test";
import { Encoding, HttpRequest, HttpResponse, StatusCode } from "@taxum/core/http";
import type { HttpService } from "@taxum/core/service";
import type { Ranges } from "range-parser";

describe("serve-dir", () => {
    const openFileMock = mock.fn<typeof import("../src/open-file.js").openFile>();
    let ServeDir: typeof import("../src/serve-dir.js").ServeDir;
    let ServeVariant: typeof import("../src/serve-dir.js").ServeVariant;

    before(async () => {
        mock.module("../src/open-file.js", {
            namedExports: {
                openFile: openFileMock,
            },
        });

        ({ ServeDir, ServeVariant } = await import("../src/serve-dir.js"));
    });

    beforeEach(() => {
        openFileMock.mock.resetCalls();
    });

    for (const code of ["ENOENT", "ENOTDIR", "EACCESS"]) {
        it(`returns 404 if openFile throws ${code} and no fallback`, async () => {
            openFileMock.mock.mockImplementationOnce(async () => {
                const error = new Error("FS error");
                (error as NodeJS.ErrnoException).code = code;
                (error as NodeJS.ErrnoException).errno = 3;
                throw error;
            });

            const service = new ServeDir("testdir");
            const req = HttpRequest.builder().path("/file.txt").body(null);

            const res = await service.invoke(req);
            assert.equal(res.status, StatusCode.NOT_FOUND);
        });
    }

    it("returns file response if openFile returns file_opened", async () => {
        const lastModified = new Date();

        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            mime: "text/plain",
            encoding: null,
            lastModified,
            extent: {
                type: "full",
                stats: { size: 10 } as Stats,
                file: { createReadStream: () => Readable.from("stream") } as fs.FileHandle,
            },
            range: null,
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.OK);
        assert.equal(res.headers.get("content-type"), "text/plain");
        assert.equal(res.headers.get("content-length"), "10");
    });

    it("returns 405 if method not GET or HEAD and no fallback", async () => {
        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().method("POST").path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.METHOD_NOT_ALLOWED);
    });

    it("calls fallback on method not allowed if configured", async () => {
        const fallback: HttpService = {
            invoke: () => HttpResponse.from("fallback"),
        };

        const service = new ServeDir("testdir")
            .fallback(fallback)
            .callFallbackOnMethodNotAllowed(true);

        const req = HttpRequest.builder().method("POST").path("/file.txt").body(null);

        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.OK);
        assert.equal(await consumers.text(res.body.read()), "fallback");
    });

    it("overrides status code on not found service fallback", async () => {
        const fallback: HttpService = {
            invoke: () => HttpResponse.from("fallback"),
        };

        const service = new ServeDir("testdir")
            .notFoundService(fallback)
            .callFallbackOnMethodNotAllowed(true);

        const req = HttpRequest.builder().method("POST").path("/file.txt").body(null);
        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.NOT_FOUND);
        assert.equal(await consumers.text(res.body.read()), "fallback");
    });

    it("returns redirect if openFile returns redirect", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "redirect",
            location: "http://example.com/",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/oldpath").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.TEMPORARY_REDIRECT);
        assert.equal(res.headers.get("location"), "http://example.com/");
    });

    it("returns 412 on precondition_failed", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "precondition_failed",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.PRECONDITION_FAILED);
    });

    it("returns 304 on not_modified", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "not_modified",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.NOT_MODIFIED);
    });

    it("uses fallback service on file_not_found", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_not_found",
        }));

        const fallback: HttpService = {
            invoke: () => HttpResponse.from("fallback"),
        };

        const service = new ServeDir("testdir").fallback(fallback);
        const req = HttpRequest.builder().path("/missing.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.OK);
        assert.equal(await consumers.text(res.body.read()), "fallback");
    });

    it("passed single file path as is", async () => {
        let openFileCalled = false;

        openFileMock.mock.mockImplementationOnce(async (_, path) => {
            assert(path.endsWith("packages/test"));
            openFileCalled = true;
            return { type: "file_not_found" };
        });

        const service = ServeDir.newSingleFile("../test", "text/plain");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        await service.invoke(req);
        assert(openFileCalled);
    });

    it("adds content-encoding header if available", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range: null,
            lastModified: new Date(),
            encoding: Encoding.GZIP,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), "gzip");
    });

    it("omits content-encoding header with no encoding", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range: null,
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
    });

    it("omits content-encoding header with identity encoding", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range: null,
            lastModified: new Date(),
            encoding: Encoding.IDENTITY,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
    });

    it("returns 500 on unknown error", async (t) => {
        const spy = t.mock.method(console, "error", () => {
            // Suppress console.error
        });

        openFileMock.mock.mockImplementationOnce(async () => {
            throw new Error("test");
        });

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);
        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.INTERNAL_SERVER_ERROR);
        assert.match(spy.mock.calls[0].arguments[0], /Failed to read file/i);
    });

    it("returns 500 on string error", async (t) => {
        const spy = t.mock.method(console, "error", () => {
            // Suppress console.error
        });

        openFileMock.mock.mockImplementationOnce(async () => {
            throw "test";
        });

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);
        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.INTERNAL_SERVER_ERROR);
        assert.match(spy.mock.calls[0].arguments[0], /Failed to read file/i);
    });

    it("returns 500 on unknown FS error", async (t) => {
        const spy = t.mock.method(console, "error", () => {
            // Suppress console.error
        });

        openFileMock.mock.mockImplementationOnce(async () => {
            const error = new Error("FS error");
            (error as NodeJS.ErrnoException).code = "EWHATEVER";
            (error as NodeJS.ErrnoException).errno = 3;
            throw error;
        });

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);
        const res = await service.invoke(req);

        assert.equal(res.status, StatusCode.INTERNAL_SERVER_ERROR);
        assert.match(spy.mock.calls[0].arguments[0], /Failed to read file/i);
    });

    it("returns 404 if path is illegal", async () => {
        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().body(null);
        req.uri.pathname = "/C:/etc/passwd";

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.NOT_FOUND);
    });

    it("returns 416 when range header is invalid", async () => {
        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range: new Error(),
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.RANGE_NOT_SATISFIABLE);
    });

    it("returns 416 when range header has no ranges", async () => {
        const range = [] as unknown as Ranges;
        range.type = "bytes";

        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range,
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.RANGE_NOT_SATISFIABLE);
        assert.equal(
            await consumers.text(res.body.read()),
            "No range found after parsing range header, please file an issue",
        );
    });

    it("returns 416 when range header has more than one range", async () => {
        const range = [{}, {}] as unknown as Ranges;
        range.type = "bytes";

        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range,
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.RANGE_NOT_SATISFIABLE);
        assert.equal(
            await consumers.text(res.body.read()),
            "Cannot serve multipart range requests",
        );
    });

    it("returns ranged HEAD response", async () => {
        const range = [{ start: 0, end: 10 }] as unknown as Ranges;
        range.type = "bytes";

        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 20 } as Stats },
            range,
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.PARTIAL_CONTENT);
        assert.equal(res.headers.get("content-length"), "11");
    });

    it("returns ranged HEAD response with 0 content length if size is 0", async () => {
        const range = [{ start: 0, end: 10 }] as unknown as Ranges;
        range.type = "bytes";

        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: { type: "head", stats: { size: 0 } as Stats },
            range,
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.PARTIAL_CONTENT);
        assert.equal(res.headers.get("content-length"), "0");
    });

    it("forwards range to createReadStream", async () => {
        const range = [{ start: 0, end: 10 }] as unknown as Ranges;
        range.type = "bytes";
        let createReadStreamCalled = false;

        openFileMock.mock.mockImplementationOnce(async () => ({
            type: "file_opened",
            extent: {
                type: "full",
                stats: { size: 20 } as Stats,
                file: {
                    createReadStream: (options) => {
                        createReadStreamCalled = true;
                        assert(options);
                        assert.equal(options.start, 0);
                        assert.equal(options.end, 10);

                        return Readable.from("stream");
                    },
                } as fs.FileHandle,
            },
            range,
            lastModified: new Date(),
            encoding: null,
            mime: "text/plain",
        }));

        const service = new ServeDir("testdir");
        const req = HttpRequest.builder().path("/file.txt").body(null);

        const res = await service.invoke(req);
        assert.equal(res.status, StatusCode.PARTIAL_CONTENT);
        assert.equal(res.headers.get("content-length"), "11");
        assert(createReadStreamCalled);
    });

    it("allows disabling appendIndexHtmlOnDirectories", async () => {
        let openFileCalled = false;

        openFileMock.mock.mockImplementationOnce(async (variant) => {
            openFileCalled = true;
            assert.equal(variant.inner.type, "directory");
            assert(!variant.inner.appendIndexHtmlOnDirectories);
            return { type: "file_not_found" };
        });

        const service = new ServeDir("testdir").appendIndexHtmlOnDirectories(false);
        const req = HttpRequest.builder().body(null);

        await service.invoke(req);
        assert(openFileCalled);
    });

    it("allows enabling all encodings", async () => {
        let openFileCalled = false;

        openFileMock.mock.mockImplementationOnce(async (_v, _p, _r, negotiatedEncodings) => {
            openFileCalled = true;

            assert(negotiatedEncodings.some(([encoding]) => encoding === Encoding.DEFLATE));
            assert(negotiatedEncodings.some(([encoding]) => encoding === Encoding.GZIP));
            assert(negotiatedEncodings.some(([encoding]) => encoding === Encoding.BROTLI));
            assert(negotiatedEncodings.some(([encoding]) => encoding === Encoding.ZSTD));
            return { type: "file_not_found" };
        });

        const service = new ServeDir("testdir")
            .precompressedDeflate()
            .precompressedGzip()
            .precompressedBr()
            .precompressedZstd();
        const req = HttpRequest.builder()
            .header("accept-encoding", "deflate, gzip, br, zstd")
            .body(null);

        await service.invoke(req);
        assert(openFileCalled);
    });

    describe("ServeVariant", () => {
        const basePath = "/base/path";

        describe("singleFile variant", () => {
            it("always returns base path regardless of requestedPath", () => {
                const variant = ServeVariant.singleFile("text/html");

                assert.equal(variant.buildAndValidatePath(basePath, "/anything/here"), basePath);
                assert.equal(variant.buildAndValidatePath(basePath, "/"), basePath);
                assert.equal(variant.buildAndValidatePath(basePath, ""), basePath);
                assert.equal(variant.buildAndValidatePath(basePath, "/.."), basePath);
            });
        });

        describe("directory variant", () => {
            it("returns full path correctly for valid paths", () => {
                const variant = ServeVariant.directory(true);

                assert.equal(
                    variant.buildAndValidatePath(basePath, "/foo/bar.txt"),
                    Path.join(basePath, "foo", "bar.txt"),
                );

                assert.equal(
                    variant.buildAndValidatePath(basePath, "/foo\\\\bar/baz"),
                    Path.join(basePath, "foo", "bar", "baz"),
                );

                assert.equal(
                    variant.buildAndValidatePath(basePath, "/foo/bar/"),
                    Path.join(basePath, "foo", "bar"),
                );

                assert.equal(
                    variant.buildAndValidatePath(basePath, "foo/bar"),
                    Path.join(basePath, "foo", "bar"),
                );
            });

            it("returns null for paths with '.' or '..'", () => {
                const variant = ServeVariant.directory(true);

                assert.equal(variant.buildAndValidatePath(basePath, "/foo/../bar"), null);
                assert.equal(variant.buildAndValidatePath(basePath, "/./bar"), null);
                assert.equal(variant.buildAndValidatePath(basePath, "/foo/./bar"), null);
                assert.equal(variant.buildAndValidatePath(basePath, "/.."), null);
            });

            it("returns null for paths containing Windows drive letters", () => {
                const variant = ServeVariant.directory(true);

                assert.equal(variant.buildAndValidatePath(basePath, "/C:/windows"), null);
                assert.equal(variant.buildAndValidatePath(basePath, "D:\\folder"), null);
                assert.equal(variant.buildAndValidatePath(basePath, "/E:/folder/file.txt"), null);
            });

            it("decodes URL encoded characters in path", () => {
                const variant = ServeVariant.directory(true);

                const encodedPath = "/foo/%2E%2E/bar";
                assert.equal(variant.buildAndValidatePath(basePath, encodedPath), null);

                assert.equal(
                    variant.buildAndValidatePath(basePath, "/foo%20bar/baz"),
                    Path.join(basePath, "foo bar", "baz"),
                );
            });

            it("returns null on empty or only slashes requestedPath", () => {
                const variant = ServeVariant.directory(true);

                assert.equal(variant.buildAndValidatePath(basePath, "/"), basePath);
                assert.equal(variant.buildAndValidatePath(basePath, ""), basePath);
                assert.equal(variant.buildAndValidatePath(basePath, "////"), basePath);
            });
        });
    });
});
