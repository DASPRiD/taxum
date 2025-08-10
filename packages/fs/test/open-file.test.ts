import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { Encoding, HeaderMap, HttpRequest } from "@taxum/core/http";
import { openFile } from "../src/open-file.js";
import { ServeVariant } from "../src/serve-dir.js";
import { isErrnoException } from "../src/util.js";

const TEST_DIR = path.resolve("test/assets");
const COMPRESSED_FILE = path.join(TEST_DIR, "file.txt");
const UNCOMPRESSED_FILE = path.join(TEST_DIR, "plain.txt");
const UNKNOWN_FILE = path.join(TEST_DIR, "unknown");

const dummyUrl = new URL("http://localhost/file.txt");

function createReq(method: string, headers: Record<string, string> = {}, uri = dummyUrl) {
    return HttpRequest.builder()
        .method(method)
        .headers(
            new HeaderMap(new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), [v]]))),
        )
        .uri(uri)
        .body(null);
}

const fileVariant = ServeVariant.singleFile("text/plain");
const dirVariantAppend = ServeVariant.directory(true);
const dirVariantNoAppend = ServeVariant.directory(false);

describe("open-file", () => {
    it("serves a regular file", async () => {
        const req = createReq("GET");
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], null);
        assert.equal(output.type, "file_opened");
        assert.equal(output.mime, "text/plain");
        assert(output.extent.type === "full");
        assert(output.range === null);
        await output.extent.file.close();
    });

    it("falls back to application/octet-stream", async () => {
        const req = createReq("HEAD");
        const output = await openFile(dirVariantNoAppend, UNKNOWN_FILE, req, [], null);
        assert.equal(output.type, "file_opened");
        assert.equal(output.mime, "application/octet-stream");
    });

    it("ignores invalid If-Modified-Since header", async () => {
        const req = createReq("HEAD", { "if-modified-since": "invalid-date" });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], null);
        assert.equal(output.type, "file_opened");
    });

    it("serves a HEAD request with file metadata", async () => {
        const req = createReq("HEAD");
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], null);
        assert.equal(output.type, "file_opened");
        assert.equal(output.extent.type, "head");
        assert(output.range === null);
    });

    it("returns not_modified for HEAD request if If-Modified-Since header indicates not modified", async () => {
        const stats = await fs.stat(COMPRESSED_FILE);
        const ims = stats.mtime.toUTCString();

        const req = createReq("HEAD", { "if-modified-since": ims });
        const negotiatedEncodings: [Encoding, number][] = [];

        const output = await openFile(fileVariant, COMPRESSED_FILE, req, negotiatedEncodings, null);
        assert.equal(output.type, "not_modified");
    });

    it("returns precondition_failed for HEAD request if If-Unmodified-Since header indicates precondition failed", async () => {
        const stats = await fs.stat(COMPRESSED_FILE);
        const ius = new Date(stats.mtime.getTime() - 10000).toUTCString();

        const req = createReq("HEAD", { "if-unmodified-since": ius });
        const negotiatedEncodings: [Encoding, number][] = [];

        const output = await openFile(fileVariant, COMPRESSED_FILE, req, negotiatedEncodings, null);
        assert.equal(output.type, "precondition_failed");
    });

    it("returns not_modified if If-Modified-Since header present and file not changed", async () => {
        const stats = await fs.stat(COMPRESSED_FILE);
        const ims = stats.mtime.toUTCString();

        const req = createReq("GET", { "if-modified-since": ims });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], null);
        assert.equal(output.type, "not_modified");
    });

    it("returns precondition_failed if If-Unmodified-Since header present and file changed", async () => {
        const stats = await fs.stat(COMPRESSED_FILE);
        const pastDate = new Date(stats.mtime.getTime() - 10000).toUTCString();

        const req = createReq("GET", { "if-unmodified-since": pastDate });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], null);
        assert.equal(output.type, "precondition_failed");
    });

    it("parses valid byte range header", async () => {
        const req = createReq("GET", { range: "bytes=0-4" });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], "bytes=0-4");
        assert.equal(output.type, "file_opened");
        assert(output.range !== null && !(output.range instanceof Error));
        assert(output.extent.type === "full");
        await output.extent.file.close();
    });

    it("returns error on invalid byte range header", async () => {
        const req = createReq("GET", { range: "bytes=500-1000" });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], "bytes=500-1000");
        assert.equal(output.type, "file_opened");
        assert(output.range instanceof Error);
        assert.equal(output.range.message, "Unsatisfiable range");
        assert(output.extent.type === "full");
        await output.extent.file.close();
    });

    it("returns error on invalid byte range header", async () => {
        const req = createReq("GET", { range: "bytes" });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], "bytes");
        assert.equal(output.type, "file_opened");
        assert(output.range instanceof Error);
        assert.equal(output.range.message, "Invalid range");
        assert(output.extent.type === "full");
        await output.extent.file.close();
    });

    it("returns error on invalid range header unit", async () => {
        const req = createReq("GET", { range: "cookies=500-1000" });
        const output = await openFile(fileVariant, COMPRESSED_FILE, req, [], "cookies=500-1000");
        assert.equal(output.type, "file_opened");
        assert(output.range instanceof Error);
        assert.equal(output.range.message, "Unsatisfiable range");
        assert(output.extent.type === "full");
        await output.extent.file.close();
    });

    it("returns file_not_found to HEAD for non-existing file", async () => {
        const req = createReq("HEAD");

        await assert.rejects(openFile(fileVariant, "non-existent.txt", req, [], null), (error) => {
            assert(isErrnoException(error));
            assert.equal(error.code, "ENOENT");
            return true;
        });
    });

    it("returns file_not_found for non-existing file", async () => {
        const req = createReq("GET");

        await assert.rejects(openFile(fileVariant, "non-existent.txt", req, [], null), (error) => {
            assert(isErrnoException(error));
            assert.equal(error.code, "ENOENT");
            return true;
        });
    });

    it("redirects directory URL without trailing slash (appendIndexHtmlOnDirectories true)", async () => {
        const req = createReq("GET", {}, new URL("http://localhost/assets"));
        const output = await openFile(dirVariantAppend, TEST_DIR, req, [], null);
        assert.equal(output.type, "redirect");
        assert(output.location.endsWith("/"));
    });

    it("appends index.html on directory URL with trailing slash (appendIndexHtmlOnDirectories true)", async () => {
        const url = new URL("http://localhost/assets/");
        const req = createReq("GET", {}, url);
        const output = await openFile(dirVariantAppend, TEST_DIR, req, [], null);
        assert.equal(output.type, "file_opened");
        assert(output.extent.type === "full");
        assert(output.mime === "text/html");
        await output.extent.file.close();
    });

    it("returns file_not_found on directory URL when appendIndexHtmlOnDirectories false", async () => {
        const req = createReq("GET", {}, new URL("http://localhost/assets"));
        const output = await openFile(dirVariantNoAppend, TEST_DIR, req, [], null);
        assert.equal(output.type, "file_not_found");
    });

    it("returns file_not_found on non-directory", async () => {
        const req = createReq("GET", {}, new URL("http://localhost/assets/plain.txt/hello"));
        await assert.rejects(
            openFile(dirVariantNoAppend, path.join(TEST_DIR, "file.txt/test.html"), req, [], null),
            (error) => {
                assert(isErrnoException(error));
                assert.equal(error.code, "ENOTDIR");
                return true;
            },
        );
    });

    it("serves with negotiated encoding fallback (gzip)", async () => {
        const req = createReq("GET");
        const negotiatedEncodings: [Encoding, number][] = [
            [Encoding.GZIP, 1],
            [Encoding.BROTLI, 0.8],
        ];

        const output = await openFile(fileVariant, COMPRESSED_FILE, req, negotiatedEncodings, null);
        assert.equal(output.type, "file_opened");
        assert.equal(output.encoding, Encoding.GZIP);
        assert(output.extent.type === "full");
        await output.extent.file.close();
    });

    it("falls back to unencoded file if encoded file missing", async () => {
        const req = createReq("GET");
        const negotiatedEncodings: [Encoding, number][] = [
            [Encoding.ZSTD, 1],
            [Encoding.GZIP, 0.8],
        ];

        const output = await openFile(
            fileVariant,
            UNCOMPRESSED_FILE,
            req,
            negotiatedEncodings,
            null,
        );
        assert.equal(output.type, "file_opened");
        assert(output.encoding === null);
        assert(output.extent.type === "full");
        await output.extent.file.close();
    });

    it("returns to HEAD with negotiated encoding fallback (gzip)", async () => {
        const req = createReq("HEAD");
        const negotiatedEncodings: [Encoding, number][] = [
            [Encoding.GZIP, 1],
            [Encoding.BROTLI, 0.8],
        ];

        const output = await openFile(fileVariant, COMPRESSED_FILE, req, negotiatedEncodings, null);
        assert.equal(output.type, "file_opened");
        assert.equal(output.encoding, Encoding.GZIP);
        assert(output.extent.type === "head");
    });

    it("falls back for HEAD to unencoded file if encoded file missing", async () => {
        const req = createReq("HEAD");
        const negotiatedEncodings: [Encoding, number][] = [
            [Encoding.ZSTD, 1],
            [Encoding.GZIP, 0.8],
        ];

        const output = await openFile(
            fileVariant,
            UNCOMPRESSED_FILE,
            req,
            negotiatedEncodings,
            null,
        );
        assert.equal(output.type, "file_opened");
        assert(output.encoding === null);
        assert(output.extent.type === "head");
    });
});
