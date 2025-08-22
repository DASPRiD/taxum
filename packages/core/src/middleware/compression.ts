import zlib, { type BrotliOptions, type ZlibOptions, type ZstdOptions } from "node:zlib";
import { Body } from "../http/body.js";
import { Encoding, type HttpRequest, HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";
import { applyNodeJsTransform } from "../util/index.js";
import { AcceptEncoding } from "./compression-utils.js";

/**
 * Level of compression data should be compressed with.
 *
 * Supports the following pre-defined values:
 *
 * - `"fastest"`: fastest quality of compression, usually produces bigger size.
 * - `"best"`: best quality of compression, usually produces the smallest size.
 * - `"default"`: default quality of compression defined by the selected
 *   compression algorithm.
 *
 * You can also set this value to a `number` to define a precise quality based
 * on the underlying compression algorithms' qualities.
 *
 * The interpretation of this depends on the algorithm chosen and the specific
 * implementation backing it.
 *
 * Qualities are implicitly clamped to the algorithm's maximum.
 */
export type CompressionLevel = "fastest" | "best" | "default" | number;
export type Predicate = (response: HttpResponse) => boolean;

/**
 * A layer that compresses response bodies.
 *
 * This uses the `Accept-Encoding` header to pick an appropriate encoding and
 * adds the `Content-Encoding` header to responses.
 *
 * @example
 * ```ts
 * import { ResponseCompressionLayer } from "@taxum/core/middleware/compression";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new ResponseCompressionLayer());
 * ```
 */
export class ResponseCompressionLayer implements HttpLayer {
    private readonly accept: AcceptEncoding;
    private predicate: Predicate;
    private compressionLevel: CompressionLevel;

    /**
     * Creates a new {@link ResponseCompressionLayer}.
     *
     * By default, all encodings are accepted and the
     * {@link CompressionLevel | default compression level} is used.
     *
     * @see {@link DEFAULT_PREDICATE}
     */
    public constructor() {
        this.accept = new AcceptEncoding();
        this.predicate = DEFAULT_PREDICATE;
        this.compressionLevel = "default";
    }

    /**
     * Sets whether to support gzip encoding.
     */
    public gzip(enable: boolean): this {
        this.accept.setGzip(enable);
        return this;
    }

    /**
     * Sets whether to support Deflate encoding.
     */
    public deflate(enable: boolean): this {
        this.accept.setDeflate(enable);
        return this;
    }

    /**
     * Sets whether to support Brotli encoding.
     */
    public br(enable: boolean): this {
        this.accept.setBr(enable);
        return this;
    }

    /**
     * Sets whether to support Zstd encoding.
     */
    public zstd(enable: boolean): this {
        this.accept.setZstd(enable);
        return this;
    }

    /**
     * Sets the compression quality.
     */
    public quality(level: CompressionLevel): this {
        this.compressionLevel = level;
        return this;
    }

    /**
     * Disabled support for gzip encoding.
     */
    public noGzip(): this {
        return this.gzip(false);
    }

    /**
     * Disables support for Deflate encoding.
     */
    public noDeflate(): this {
        return this.deflate(false);
    }

    /**
     * Disables support for Brotli encoding.
     */
    public noBr(): this {
        return this.br(false);
    }

    /**
     * Disables support for Zstd encoding.
     */
    public noZstd(): this {
        return this.zstd(false);
    }

    /**
     * Replace the current compression predicate.
     *
     * Predicates are used to determine whether a response should be compressed
     * or not. The default predicate is {@link DEFAULT_PREDICATE}. See its
     * documentation for more details on which responses it won't compress.
     *
     * Responses that are already compressed (i.e., have a `content-encoding`
     * header) will _never_ be recompressed, regardless of what the predicate
     * says.
     */
    public compressWhen(predicate: Predicate): this {
        this.predicate = predicate;
        return this;
    }

    public layer(inner: HttpService): HttpService {
        return new ResponseCompression(inner, this.accept, this.predicate, this.compressionLevel);
    }
}

class ResponseCompression implements HttpService {
    private readonly inner: HttpService;
    private readonly accept: AcceptEncoding;
    private readonly predicate: Predicate;
    private readonly compressionLevel: CompressionLevel;

    public constructor(
        inner: HttpService,
        accept: AcceptEncoding,
        predicate: Predicate,
        compressionLevel: CompressionLevel,
    ) {
        this.inner = inner;
        this.accept = accept;
        this.predicate = predicate;
        this.compressionLevel = compressionLevel;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const encoding = Encoding.fromHeaders(req.headers, this.accept);
        const res = await this.inner.invoke(req);

        if (!this.shouldCompress(encoding, res)) {
            return res;
        }

        const compressorBuilder = compressors.get(encoding);

        /* node:coverage ignore next 4 */
        if (!compressorBuilder) {
            // Should normally never happen, but just in case.
            return res;
        }

        const headers = res.headers;

        if (!headers.get("vary")?.toLowerCase().includes("accept-encoding")) {
            headers.append("vary", "accept-encoding");
        }

        headers.remove("accept-ranges");
        headers.remove("content-length");
        headers.insert("content-encoding", encoding.value);

        const compressor = compressorBuilder(this.compressionLevel);
        const compressedStream = compressor(res.body.readable);

        return new HttpResponse(res.status, headers, new Body(compressedStream));
    }

    private shouldCompress(encoding: Encoding, res: HttpResponse): boolean {
        if (encoding === Encoding.IDENTITY) {
            // No compression supported.
            return false;
        }

        if (
            res.headers.containsKey("content-encoding") ||
            res.headers.containsKey("content-range")
        ) {
            // Do not compress already compressed responses or those that are ranges.
            return false;
        }

        return this.predicate(res);
    }
}

type Compressor = (level: CompressionLevel) => (stream: ReadableStream) => ReadableStream;

const compressors = new Map<Encoding, Compressor>([
    [
        Encoding.DEFLATE,
        (level) => {
            const options: ZlibOptions = { level: zlibQuality(level) };

            return (value: ReadableStream) =>
                applyNodeJsTransform(value, zlib.createDeflate(options));
        },
    ],
    [
        Encoding.GZIP,
        (level) => {
            const options: ZlibOptions = { level: zlibQuality(level) };

            return (value: ReadableStream) => applyNodeJsTransform(value, zlib.createGzip(options));
        },
    ],
    [
        Encoding.BROTLI,
        (level) => {
            const options: BrotliOptions = {
                params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: brotliQuality(level),
                },
            };

            return (value: ReadableStream) =>
                applyNodeJsTransform(value, zlib.createBrotliCompress(options));
        },
    ],
    [
        Encoding.ZSTD,
        (level) => {
            const options: ZstdOptions = {
                params: {
                    [zlib.constants.ZSTD_c_compressionLevel]: zstdQuality(level),
                },
            };

            return (value: ReadableStream) =>
                applyNodeJsTransform(value, zlib.createZstdCompress(options));
        },
    ],
]);

const zlibQuality = (level: CompressionLevel): number => {
    if (typeof level === "number") {
        return Math.min(
            zlib.constants.Z_BEST_COMPRESSION,
            Math.max(zlib.constants.Z_BEST_SPEED, level),
        );
    }

    switch (level) {
        case "fastest":
            return zlib.constants.Z_BEST_SPEED;

        case "best":
            return zlib.constants.Z_BEST_COMPRESSION;

        case "default":
            return zlib.constants.Z_DEFAULT_COMPRESSION;
    }
};

const brotliQuality = (level: CompressionLevel): number => {
    if (typeof level === "number") {
        return Math.min(
            zlib.constants.BROTLI_MAX_QUALITY,
            Math.max(zlib.constants.BROTLI_MIN_QUALITY, level),
        );
    }

    switch (level) {
        case "fastest":
            return zlib.constants.BROTLI_MIN_QUALITY;

        case "best":
            return zlib.constants.BROTLI_MAX_QUALITY;

        case "default":
            return zlib.constants.BROTLI_DEFAULT_QUALITY;
    }
};

const MIN_ZSTD_QUALITY = -131072;
const MAX_ZSTD_QUALITY = 22;

const zstdQuality = (level: CompressionLevel): number => {
    if (typeof level === "number") {
        return Math.min(MAX_ZSTD_QUALITY, Math.max(MIN_ZSTD_QUALITY, level));
    }

    switch (level) {
        case "fastest":
            return 1;

        case "best":
            return MAX_ZSTD_QUALITY;

        case "default":
            return zlib.constants.ZSTD_CLEVEL_DEFAULT;
    }
};

/**
 * Combination of multiple predicates.
 */
export const andPredicate =
    (predicates: Predicate[]): Predicate =>
    (response) => {
        for (const predicate of predicates) {
            if (!predicate(response)) {
                return false;
            }
        }

        return true;
    };

/**
 * Predicate that will only allow compression of responses above a certain size.
 *
 * The content size is determined through either the body size or the content-length header.
 * If neither can be determined (e.g., the body is a `Readable`), the response will always be compressed.
 */
export const sizeAbovePredicate =
    (minSize: number): Predicate =>
    (response) => {
        let contentSize = response.body.sizeHint.upper;

        if (contentSize === null) {
            const contentLength = response.headers.get("content-length");

            if (!contentLength) {
                return true;
            }

            contentSize = Number.parseInt(contentLength, 10);
        }

        return contentSize >= minSize;
    };

/**
 * Predicate that won't allow responses with a specific `content-type` to be compressed.
 */
export const notForContentTypePredicate =
    (contentType: string, exception?: string): Predicate =>
    (response) => {
        const headerContentType = response.headers.get("content-type") ?? "";

        if (headerContentType === exception) {
            return true;
        }

        return !headerContentType.startsWith(contentType);
    };

/**
 * Default predicate for response compression.
 *
 * All responses will be compressed unless:
 *
 * - They're gRPC, which has its own protocol-specific compression scheme.
 * - It's an image as determined by the `content-type` starting with
 *   `image/`.
 * - They're Server-Sent Events (SSE) as determined by the `content-type`
 *   being `text/event-stream`.
 * - The response is less than 32
 */
export const DEFAULT_PREDICATE = andPredicate([
    sizeAbovePredicate(32),
    notForContentTypePredicate("application/grpc"),
    notForContentTypePredicate("image/", "image/svg+xml"),
    notForContentTypePredicate("text/event-stream"),
]);
