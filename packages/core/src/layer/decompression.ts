import type { Transform } from "node:stream";
import zlib from "node:zlib";
import { HttpResponse, StatusCode } from "../http/index.js";
import { HttpRequest } from "../http/request.js";
import type { Layer, Service } from "../routing/index.js";
import { AcceptEncoding } from "./compression-utils.js";

/**
 * A layer that decompresses request bodies.
 *
 * @example
 * ```ts
 * import { RequestDecompressionLayer } from "@taxum/core/layer/decompression";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new RequestDecompressionLayer());
 * ```
 */
export class RequestDecompressionLayer implements Layer {
    private readonly accept: AcceptEncoding;
    private passThroughUnaccepted_ = false;

    /**
     * Creates a new {@link RequestDecompressionLayer}.
     *
     * By default, all encodings are accepted and unaccepted encodings are
     * **not** passed through.
     */
    public constructor() {
        this.accept = new AcceptEncoding();
        this.passThroughUnaccepted_ = false;
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
    private readonly accept: AcceptEncoding;
    private readonly passThroughUnaccepted: boolean;

    public constructor(inner: Service, accept: AcceptEncoding, passThroughUnaccepted: boolean) {
        this.inner = inner;
        this.accept = accept;
        this.passThroughUnaccepted = passThroughUnaccepted;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const contentEncoding = req.headers.get("content-encoding");

        if (!contentEncoding) {
            return this.inner.invoke(req);
        }

        if (contentEncoding === "deflate" && this.accept.deflate()) {
            return invokeWithTransform(this.inner, req, zlib.createInflate());
        }

        if (contentEncoding === "gzip" && this.accept.gzip()) {
            return invokeWithTransform(this.inner, req, zlib.createGunzip());
        }

        if (contentEncoding === "br" && this.accept.br()) {
            return invokeWithTransform(this.inner, req, zlib.createBrotliDecompress());
        }

        if (contentEncoding === "zstd" && this.accept.zstd()) {
            return invokeWithTransform(this.inner, req, zlib.createZstdDecompress());
        }

        if (contentEncoding === "identity" || this.passThroughUnaccepted) {
            return this.inner.invoke(req);
        }

        return HttpResponse.builder()
            .status(StatusCode.UNSUPPORTED_MEDIA_TYPE)
            .header("accept-encoding", this.accept.toHeaderValue() ?? "identity")
            .body(null);
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
