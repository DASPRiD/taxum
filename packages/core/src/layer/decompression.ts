import type { Transform } from "node:stream";
import zlib from "node:zlib";
import { match } from "ts-pattern";
import { HttpResponse, StatusCode } from "../http/index.js";
import { HttpRequest } from "../http/request.js";
import type { Layer, Service } from "../routing/index.js";

export type Encoding = "deflate" | "gzip" | "brotli" | "zstd";

/**
 * A layer that decompresses request bodies.
 *
 * @example
 * ```ts
 * import { decompression } from "@taxum/core/layer";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new decompression.RequestDecompressionLayer());
 * ```
 */
export class RequestDecompressionLayer implements Layer {
    private readonly accept: Set<Encoding>;
    private passThroughUnaccepted_ = false;

    /**
     * Creates a new {@link RequestDecompressionLayer}.
     *
     * By default, all encodings are accepted and unaccepted encodings are
     * **not** passed through.
     */
    public constructor() {
        this.accept = new Set(["deflate", "gzip", "brotli", "zstd"]);
        this.passThroughUnaccepted_ = false;
    }

    /**
     * Sets whether to support gzip encoding.
     */
    public gzip(enabled: boolean): this {
        if (enabled) {
            this.accept.add("gzip");
        } else {
            this.accept.delete("gzip");
        }

        return this;
    }

    /**
     * Sets whether to support Deflate encoding.
     */
    public deflate(enabled: boolean): this {
        if (enabled) {
            this.accept.add("deflate");
        } else {
            this.accept.delete("deflate");
        }

        return this;
    }

    /**
     * Sets whether to support Brotli encoding.
     */
    public brotli(enabled: boolean): this {
        if (enabled) {
            this.accept.add("brotli");
        } else {
            this.accept.delete("brotli");
        }

        return this;
    }

    /**
     * Sets whether to support Zstd encoding.
     */
    public zstd(enabled: boolean): this {
        if (enabled) {
            this.accept.add("zstd");
        } else {
            this.accept.delete("zstd");
        }

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
    public noBrotli(): this {
        return this.brotli(false);
    }

    /**
     * Disables support for Zstd encoding.
     */
    public noZstd(): this {
        return this.zstd(false);
    }

    /**
     * Sets whether to pass through the request even when the encoding is not
     * supported.
     */
    public passThroughUnaccepted(enabled: boolean): this {
        this.passThroughUnaccepted_ = enabled;
        return this;
    }

    public layer(inner: Service): Service {
        return new RequestDecompression(inner, this.accept, this.passThroughUnaccepted_);
    }
}

class RequestDecompression implements Service {
    private readonly inner: Service;
    private readonly accept: Set<Encoding>;
    private readonly passThroughUnaccepted: boolean;

    public constructor(inner: Service, accept: Set<Encoding>, passThroughUnaccepted: boolean) {
        this.inner = inner;
        this.accept = accept;
        this.passThroughUnaccepted = passThroughUnaccepted;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const contentEncoding = req.headers.get("content-encoding");

        if (!contentEncoding) {
            return this.inner.invoke(req);
        }

        return match(contentEncoding)
            .when(
                (value) => value === "deflate" && this.accept.has("deflate"),
                () => {
                    return invokeWithTransform(this.inner, req, zlib.createInflate());
                },
            )
            .when(
                (value) => value === "gzip" && this.accept.has("gzip"),
                () => {
                    return invokeWithTransform(this.inner, req, zlib.createGunzip());
                },
            )
            .when(
                (value) => value === "br" && this.accept.has("brotli"),
                () => {
                    return invokeWithTransform(this.inner, req, zlib.createBrotliDecompress());
                },
            )
            .when(
                (value) => value === "zstd" && this.accept.has("zstd"),
                () => {
                    return invokeWithTransform(this.inner, req, zlib.createZstdDecompress());
                },
            )
            .with("identity", () => {
                return this.inner.invoke(req);
            })
            .when(
                () => this.passThroughUnaccepted,
                () => {
                    return this.inner.invoke(req);
                },
            )
            .otherwise(() => {
                return HttpResponse.builder()
                    .status(StatusCode.UNSUPPORTED_MEDIA_TYPE)
                    .header("accept-encoding", toAcceptEncodingHeader(this.accept))
                    .body(null);
            });
    }
}

const invokeWithTransform = async (
    inner: Service,
    req: HttpRequest,
    transform: Transform,
): Promise<HttpResponse> => {
    req.headers.remove("content-encoding");
    req.headers.remove("content-length");
    req.body.pipe(transform);

    return inner.invoke(new HttpRequest(req.head, transform));
};

const toAcceptEncodingHeader = (encodings: Set<Encoding>): string => {
    if (encodings.size === 0) {
        return "identity";
    }

    const values = [];

    if (encodings.has("deflate")) {
        values.push("deflate");
    }

    if (encodings.has("gzip")) {
        values.push("gzip");
    }

    if (encodings.has("brotli")) {
        values.push("br");
    }

    if (encodings.has("zstd")) {
        values.push("zstd");
    }

    return values.join(",");
};
