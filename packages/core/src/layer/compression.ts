import type { Readable } from "node:stream";
import zlib, { type BrotliOptions, type ZlibOptions, type ZstdOptions } from "node:zlib";
import { Body } from "../http/body.js";
import { type HeaderMap, HttpResponse, type ReadonlyHttpResponse } from "../http/index.js";
import type { Layer } from "../routing/index.js";

export type CompressionLevel = "fastest" | "best" | "default" | number;
export type Encoding = "identity" | "deflate" | "gzip" | "brotli" | "zstd";
export type Predicate = (response: ReadonlyHttpResponse) => boolean;
export type ResponseCompressionConfig = {
    /**
     * Encodings accepted by this layer.
     *
     * Defaults to accepting all encodings.
     */
    accept?: Set<Encoding>;

    /**
     * Level of compression data should be compressed with.
     *
     * Supports the following pre-defined values:
     *
     * - `"fastest"`: fastest quality of compression, usually produces bigger size.
     * - `"best"`: best quality of compression, usually produces smallest size.
     * - `"default"`: default quality of compression defined by the selected compression algorithm.
     *
     * You can also set this value to a `number` to define a precise quality based on the underlying compression
     * algorithms' qualities.
     *
     * The interpretation of this depends on the algorithm chosen and the specific implementation backing it.
     *
     * Qualities are implicitly clamped to the algorithm's maximum.
     */
    compressionLevel?: CompressionLevel;

    /**
     * Predicate to decide whether the response should be compressed.
     *
     * If not specified, responses will be compressed unless:
     *
     * - They're gRPC, which has its own protocol specific compression scheme.
     * - It's an image as determined by the `content-type` starting with `image/`.
     * - They're Server-Sent Events (SSE) as determined by the `content-type` being `text/event-stream`.
     * - The response is less than 32
     */
    predicate?: Predicate;
};

/**
 * Layer that adds compression to response bodies.
 */
export const responseCompressionLayer = (config?: ResponseCompressionConfig): Layer => {
    const accept: Set<Encoding> =
        config?.accept ?? new Set(["identity", "deflate", "gzip", "brotli", "zstd"]);

    const predicate =
        config?.predicate ??
        andPredicate([
            sizeAbovePredicate(32),
            notForContentTypePredicate("application/grpc"),
            notForContentTypePredicate("image/", "image/svg+xml"),
            notForContentTypePredicate("text/event-stream"),
        ]);

    const compressionLevel = config?.compressionLevel ?? "default";

    const shouldCompress = (
        encoding: Encoding,
        response: ReadonlyHttpResponse,
    ): encoding is Exclude<Encoding, "identity"> => {
        if (encoding === "identity") {
            // No compression supported.
            return false;
        }

        if (
            response.headers.containsKey("content-encoding") ||
            response.headers.containsKey("content-range")
        ) {
            // Do not compress already compressed responses or those that are ranges.
            return false;
        }

        return predicate(response);
    };

    return {
        layer: (inner) => async (req) => {
            const encoding = preferredEncoding(req.headers, accept);
            const response = await inner(req);

            if (!shouldCompress(encoding, response)) {
                return response;
            }

            const headers = response.headers.toOwned();

            if (!headers.get("vary")?.toLowerCase().includes("accept-encoding")) {
                headers.append("vary", "accept-encoding");
            }

            const compressor = compressors[encoding](compressionLevel);
            const compressedStream = compressor(response.body.read());

            return new HttpResponse(response.status, headers, new Body(compressedStream));
        },
    };
};

type Compressor = (level: CompressionLevel) => (stream: Readable) => Readable;

const compressors: Record<Exclude<Encoding, "identity">, Compressor> = {
    deflate: (level) => {
        const options: ZlibOptions = { level: zlibQuality(level) };

        return (value: Readable) => {
            const stream = zlib.createDeflate(options);
            value.pipe(stream);
            return stream;
        };
    },
    gzip: (level) => {
        const options: ZlibOptions = { level: zlibQuality(level) };

        return (value: Readable) => {
            const stream = zlib.createGzip(options);
            value.pipe(stream);
            return stream;
        };
    },
    brotli: (level) => {
        const options: BrotliOptions = {
            params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: brotliQuality(level),
            },
        };

        return (value: Readable) => {
            const stream = zlib.createBrotliCompress(options);
            value.pipe(stream);
            return stream;
        };
    },
    zstd: (level) => {
        const options: ZstdOptions = {
            params: {
                [zlib.constants.ZSTD_c_compressionLevel]: zstdQuality(level),
            },
        };

        return (value: Readable) => {
            const stream = zlib.createZstdCompress(options);
            value.pipe(stream);
            return stream;
        };
    },
};

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

const preferredEncoding = (headers: HeaderMap, accept: Set<Encoding>): Encoding => {
    const encodings = headers
        .getAll("accept-encoding")
        .flatMap((value) => value.split(","))
        .reduce<[Encoding, number][]>((results, value) => {
            const values = value.split(";", 2);
            const encoding = parseEncoding(values[0], accept);

            if (!encoding) {
                return results;
            }

            const qValue = parseQValue(values[1]);

            if (qValue === null) {
                return results;
            }

            results.push([encoding, qValue]);
            return results;
        }, [])
        .filter(([_, qValue]) => qValue > 0);

    if (encodings.length === 0) {
        return "identity";
    }

    return encodings.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
};

const parseEncoding = (value: string, accept: Set<Encoding>): Encoding | null => {
    const normalized = value.toLowerCase();

    if (normalized === "gzip" || (normalized === "x-gzip" && accept.has("gzip"))) {
        return "gzip";
    }

    if (normalized === "deflate" && accept.has("deflate")) {
        return "deflate";
    }

    if (normalized === "br" && accept.has("brotli")) {
        return "brotli";
    }

    if (normalized === "zstd" && accept.has("zstd")) {
        return "zstd";
    }

    return null;
};

const qValueRegex = /^[01](?:.\d{0,3})?$/;

const parseQValue = (value: string): number | null => {
    const normalized = value.toLowerCase().split("=", 2);

    if (normalized[0] !== "q") {
        return null;
    }

    if (!qValueRegex.test(normalized[1])) {
        return null;
    }

    const qValue = Math.floor(Number.parseFloat(normalized[1]) * 1000);
    return qValue <= 1000 ? qValue : null;
};
