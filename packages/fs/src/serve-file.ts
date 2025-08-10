import type { HttpRequest, HttpResponse } from "@taxum/core/http";
import type { Service } from "@taxum/core/routing";
import mime from "mime";
import { ServeDir } from "./serve-dir.js";

/**
 * Service that serves a single file.
 */
export class ServeFile implements Service {
    private readonly inner: ServeDir;

    /**
     * Creates a new {@link ServeFile}.
     */
    public constructor(path: string, mimeType?: string) {
        this.inner = ServeDir.newSingleFile(
            path,
            mimeType ?? mime.getType(path) ?? "application/octet-stream",
        );
    }

    /**
     * Informs the service that it should also look for a precompressed gzip
     * version of the file.
     *
     * If the client has an `Accept-Encoding` header that allows the gzip
     * encoding, the file `foo.txt.gz` instead of `foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the same directory. Different precompressed variants can be
     * combined.
     */
    public precompressedGzip(): this {
        this.inner.precompressedGzip();
        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed brotli
     * version of the file.
     *
     * If the client has an `Accept-Encoding` header that allows the brotli
     * encoding, the file `foo.txt.br` instead of `foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the same directory. Different precompressed variants can be
     * combined.
     */
    public precompressedBr(): this {
        this.inner.precompressedBr();
        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed deflate
     * version of the file.
     *
     * If the client has an `Accept-Encoding` header that allows the deflate
     * encoding, the file `foo.txt.zz` instead of `foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the same directory. Different precompressed variants can be
     * combined.
     */
    public precompressedDeflate(): this {
        this.inner.precompressedDeflate();
        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed zstd
     * version of the file.
     *
     * If the client has an `Accept-Encoding` header that allows the zstd
     * encoding, the file `foo.txt.zst` instead of `foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the same directory. Different precompressed variants can be
     * combined.
     */
    public precompressedZstd(): this {
        this.inner.precompressedZstd();
        return this;
    }

    public invoke(req: HttpRequest): Promise<HttpResponse> {
        return this.inner.invoke(req);
    }
}
