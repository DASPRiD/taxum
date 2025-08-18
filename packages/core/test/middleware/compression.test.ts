import assert from "node:assert/strict";
import { Readable } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import zlib from "node:zlib";
import { Body, HeaderMap, HttpRequest, HttpResponse, SizeHint } from "../../src/http/index.js";
import {
    andPredicate,
    type CompressionLevel,
    DEFAULT_PREDICATE,
    notForContentTypePredicate,
    ResponseCompressionLayer,
    sizeAbovePredicate,
} from "../../src/middleware/compression.js";

describe("middleware/compression", () => {
    const text = "The quick brown fox jumps over the lazy dog.";

    const dummyService = {
        invoke: async () => {
            return HttpResponse.builder()
                .status(200)
                .header("content-type", "text/plain")
                .body(text);
        },
    };

    const decompressors: Record<string, (res: HttpResponse) => Promise<string>> = {
        gzip: async (res) => {
            const buffer = await consumers.buffer(res.body.read());
            return zlib.gunzipSync(buffer).toString("utf-8");
        },
        deflate: async (res) => {
            const buffer = await consumers.buffer(res.body.read());
            return zlib.inflateSync(buffer).toString("utf-8");
        },
        br: async (res) => {
            const buffer = await consumers.buffer(res.body.read());
            return zlib.brotliDecompressSync(buffer).toString("utf-8");
        },
        zstd: async (res) => {
            const buffer = await consumers.buffer(res.body.read());
            return zlib.zstdDecompressSync(buffer).toString("utf-8");
        },
    };

    const encodingTests = [
        { encoding: "gzip", disableOthers: { deflate: false, br: false, zstd: false } },
        { encoding: "deflate", disableOthers: { gzip: false, br: false, zstd: false } },
        { encoding: "br", disableOthers: { gzip: false, deflate: false, zstd: false } },
        { encoding: "zstd", disableOthers: { gzip: false, deflate: false, br: false } },
    ];

    for (const { encoding, disableOthers } of encodingTests) {
        it(`compresses response with ${encoding} when accepted`, async () => {
            const req = HttpRequest.builder().header("accept-encoding", encoding).body(null);

            const layer = new ResponseCompressionLayer()
                .gzip(!disableOthers.gzip)
                .deflate(!disableOthers.deflate)
                .br(!disableOthers.br)
                .zstd(!disableOthers.zstd);

            const service = layer.layer(dummyService);

            const res = await service.invoke(req);
            assert.equal(res.headers.get("content-encoding"), encoding);

            const decompressed = await decompressors[encoding](res);
            assert.equal(decompressed, text);
        });
    }

    it("compresses with first matching encoding from multiple accepted encodings", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "br, gzip").body(null);
        const layer = new ResponseCompressionLayer().noDeflate().noZstd();
        const service = layer.layer(dummyService);
        const res = await service.invoke(req);

        assert.equal(res.headers.get("content-encoding"), "br");
        const decompressed = await decompressors.br(res);
        assert.equal(decompressed, text);
    });

    it("does not compress when Accept-Encoding header is missing", async () => {
        const req = HttpRequest.builder().body(null);
        const layer = new ResponseCompressionLayer();
        const service = layer.layer(dummyService);
        const res = await service.invoke(req);

        assert.equal(res.headers.get("content-encoding"), null);
        assert.equal(await consumers.text(res.body.read()), text);
    });

    it("adds Vary header with accept-encoding if missing", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () => HttpResponse.builder().body(text),
        };

        const layer = new ResponseCompressionLayer().noDeflate().noBr().noZstd();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        const vary = res.headers.get("vary");
        assert(vary?.toLowerCase().includes("accept-encoding"));
    });

    it("does not duplicate Vary header if already present", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () =>
                HttpResponse.builder().header("vary", "accept-encoding, origin").body(text),
        };

        const layer = new ResponseCompressionLayer().noDeflate().noBr().noZstd();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        const vary = res.headers.get("vary") ?? "";
        const lowerVary = vary.toLowerCase();

        assert(lowerVary.includes("accept-encoding"));
        assert(lowerVary.includes("origin"));
        assert(!lowerVary.includes("accept-encoding, accept-encoding"));
    });

    it("does not compress if content-encoding already present", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () =>
                HttpResponse.builder().header("content-encoding", "gzip").body(text),
        };

        const layer = new ResponseCompressionLayer();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), "gzip");
        assert.equal(await consumers.text(res.body.read()), text);
    });

    it("does not compress if response does not match predicate", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () =>
                HttpResponse.builder().header("content-type", "application/grpc").body(text),
        };

        const layer = new ResponseCompressionLayer();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
        assert.equal(await consumers.text(res.body.read()), text);
    });

    it("does not compress if response body is empty", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () =>
                HttpResponse.builder().header("content-type", "text/plain").body(""),
        };

        const layer = new ResponseCompressionLayer();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
        assert.equal(await consumers.text(res.body.read()), "");
    });

    it("does not compress if response has content-range header", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () =>
                HttpResponse.builder().header("content-range", "bytes 0-1023/2048").body(text),
        };

        const layer = new ResponseCompressionLayer();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
        assert.equal(await consumers.text(res.body.read()), text);
    });

    it("adds vary header if missing but does not duplicate if present", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = {
            invoke: async () => HttpResponse.builder().header("vary", "accept-encoding").body(text),
        };

        const layer = new ResponseCompressionLayer();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        const vary = res.headers.get("vary");
        assert.equal(vary?.toLowerCase(), "accept-encoding");
    });

    it("does not compress if predicate returns false", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = dummyService;
        const layer = new ResponseCompressionLayer().compressWhen(() => false);
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
        assert.equal(await consumers.text(res.body.read()), text);
    });

    it("does not compress if no encodings are supported", async () => {
        const req = HttpRequest.builder()
            .header("accept-encoding", "gzip,deflate,br,zstd")
            .body(null);
        const innerService = dummyService;
        const layer = new ResponseCompressionLayer().noGzip().noDeflate().noBr().noZstd();
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), null);
        assert.equal(await consumers.text(res.body.read()), text);
    });

    it("compresses if predicate returns true", async () => {
        const req = HttpRequest.builder().header("accept-encoding", "gzip").body(null);
        const innerService = dummyService;
        const layer = new ResponseCompressionLayer().compressWhen(() => true);
        const service = layer.layer(innerService);

        const res = await service.invoke(req);
        assert.equal(res.headers.get("content-encoding"), "gzip");
        const decompressed = await decompressors.gzip(res);
        assert.equal(decompressed, text);
    });

    for (const { encoding } of encodingTests) {
        it(`accepts and uses different compression levels for ${encoding} without error`, async () => {
            const req = HttpRequest.builder().header("accept-encoding", encoding).body(null);

            const levels: CompressionLevel[] = ["fastest", "best", "default", 1];

            for (const level of levels) {
                const layer = new ResponseCompressionLayer().quality(level);
                const service = layer.layer(dummyService);

                const res = await service.invoke(req);
                assert.equal(res.headers.get("content-encoding"), encoding);

                const decompressed = await decompressors[encoding](res);
                assert.equal(decompressed, text);
            }
        });
    }

    describe("andPredicate", () => {
        const makeResponse = () => {
            const headers = new HeaderMap();
            const body = new Body(Readable.from("test"), SizeHint.exact(4));
            return HttpResponse.builder().headers(headers).body(body);
        };

        it("returns true when all predicates return true", () => {
            const pred1 = () => true;
            const pred2 = () => true;
            const combined = andPredicate([pred1, pred2]);
            assert.equal(combined(makeResponse()), true);
        });

        it("returns false when any predicate returns false", () => {
            const pred1 = () => true;
            const pred2 = () => false;
            const combined = andPredicate([pred1, pred2]);
            assert.equal(combined(makeResponse()), false);
        });

        it("short-circuits on first false predicate", () => {
            let called = false;
            const pred1 = () => false;
            const pred2 = () => {
                called = true;
                return true;
            };
            const combined = andPredicate([pred1, pred2]);
            assert.equal(combined(makeResponse()), false);
            assert.equal(called, false);
        });

        it("returns true when no predicates provided", () => {
            const combined = andPredicate([]);
            assert.equal(combined(makeResponse()), true);
        });
    });

    describe("sizeAbovePredicate", () => {
        const makeResponse = (sizeHintUpper: number | null, headers = new HeaderMap()) => {
            const body = new Body(
                Readable.from(text),
                sizeHintUpper === null ? SizeHint.unbounded() : SizeHint.exact(sizeHintUpper),
            );
            return HttpResponse.builder().headers(headers).body(body);
        };

        it("returns true when sizeHint.upper is >= min", () => {
            const pred = sizeAbovePredicate(10);
            const res = makeResponse(20);
            assert.equal(pred(res), true);
        });

        it("returns false when sizeHint.upper is < min", () => {
            const pred = sizeAbovePredicate(50);
            const res = makeResponse(20);
            assert.equal(pred(res), false);
        });

        it("returns true when sizeHint.upper is null and content-length missing", () => {
            const pred = sizeAbovePredicate(999);
            const res = makeResponse(null);
            assert.equal(pred(res), true);
        });

        it("returns true when sizeHint.upper is null and content-length >= min", () => {
            const pred = sizeAbovePredicate(10);
            const headers = new HeaderMap();
            headers.insert("content-length", "25");
            const res = makeResponse(null, headers);
            assert.equal(pred(res), true);
        });

        it("returns false when sizeHint.upper is null and content-length < min", () => {
            const pred = sizeAbovePredicate(100);
            const headers = new HeaderMap();
            headers.insert("content-length", "25");
            const res = makeResponse(null, headers);
            assert.equal(pred(res), false);
        });
    });

    describe("notForContentTypePredicate", () => {
        const makeResponse = (contentType: string | null) => {
            const headers = new HeaderMap();

            if (contentType !== null) {
                headers.insert("content-type", contentType);
            }

            const body = new Body(Readable.from("test"), SizeHint.exact(4));
            return HttpResponse.builder().headers(headers).body(body);
        };

        it("returns false when header starts with blocked content type", () => {
            const pred = notForContentTypePredicate("image/");
            const res = makeResponse("image/png");
            assert.equal(pred(res), false);
        });

        it("returns true when header does not start with blocked content type", () => {
            const pred = notForContentTypePredicate("image/");
            const res = makeResponse("text/plain");
            assert.equal(pred(res), true);
        });

        it("returns true when header matches exception exactly", () => {
            const pred = notForContentTypePredicate("image/", "image/png");
            const res = makeResponse("image/png");
            assert.equal(pred(res), true);
        });

        it("returns true when no content-type header is set", () => {
            const pred = notForContentTypePredicate("image/");
            const res = makeResponse(null);
            assert.equal(pred(res), true);
        });
    });

    describe("DEFAULT_PREDICATE", () => {
        const makeResponse = (size: number, contentType?: string) => {
            const headers = new HeaderMap();

            if (contentType) {
                headers.insert("content-type", contentType);
            }

            const body = new Body(Readable.from("x".repeat(size)), SizeHint.exact(size));
            return HttpResponse.builder().headers(headers).body(body);
        };

        it("returns true for text/plain with size >= 32", () => {
            const res = makeResponse(40, "text/plain");
            assert.equal(DEFAULT_PREDICATE(res), true);
        });

        it("returns false for gRPC content type", () => {
            const res = makeResponse(100, "application/grpc");
            assert.equal(DEFAULT_PREDICATE(res), false);
        });

        it("returns false for image/jpeg", () => {
            const res = makeResponse(100, "image/jpeg");
            assert.equal(DEFAULT_PREDICATE(res), false);
        });

        it("returns true for image/svg+xml (exception)", () => {
            const res = makeResponse(100, "image/svg+xml");
            assert.equal(DEFAULT_PREDICATE(res), true);
        });

        it("returns false for text/event-stream", () => {
            const res = makeResponse(100, "text/event-stream");
            assert.equal(DEFAULT_PREDICATE(res), false);
        });

        it("returns false when size is less than 32 bytes", () => {
            const res = makeResponse(20, "text/plain");
            assert.equal(DEFAULT_PREDICATE(res), false);
        });
    });
});
