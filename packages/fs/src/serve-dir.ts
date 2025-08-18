/* node:coverage disable: c8 gets confused by the module mocking */
import * as Path from "node:path";
import {
    Encoding,
    encodings,
    type HttpRequest,
    HttpResponse,
    Method,
    StatusCode,
    type SupportedEncodings,
    TO_HTTP_RESPONSE,
} from "@taxum/core/http";
import { getGlobalLogger } from "@taxum/core/logger";
import { SetStatusLayer } from "@taxum/core/middleware/set-status";
import type { HttpService } from "@taxum/core/service";
import { type OpenFileOutput, openFile } from "./open-file.js";
import { isErrnoException } from "./util.js";

/* node:coverage enable */

/**
 * Service that serves files from a given directory and all its subdirectories.
 *
 * The `Content-Type` will be guessed from the file extension.
 *
 * An empty response with status `404 Not Found` will be returned if:
 *
 * - The file doesn't exist
 * - Any segment of the path contains `..`
 * - Any segment of the path contains a backslash
 * - Any segment of the path referenced as directory is actually an existing
 *   file (`/file.html/something`)
 * - We don't have necessary permissions to read the file
 *
 * @example
 * ```ts
 * import { ServeDir } from "@taxum/fs";
 *
 * // This will serve files from the "assets" directory and its subdirectories
 * const service = new ServeDir("assets");
 * ```
 */
export class ServeDir implements HttpService {
    private readonly base: string;
    private readonly precompressedVariants: PrecompressedVariants;
    private readonly variant: ServeVariant;
    private callFallbackOnMethodNotAllowed_: boolean;
    private fallback_: HttpService | null;

    /**
     * Creates a new {@link ServeDir}.
     */
    public constructor(base: string) {
        this.base = Path.resolve(base);
        this.precompressedVariants = new PrecompressedVariants();
        this.variant = ServeVariant.directory(true);
        this.callFallbackOnMethodNotAllowed_ = false;
        this.fallback_ = null;
    }

    /**
     * @internal
     */
    public static newSingleFile(path: string, mimeType: string): ServeDir {
        const service = new ServeDir(path);
        service.variant.inner = {
            type: "single_file",
            mime: mimeType,
        };
        return service;
    }

    /**
     * If the requested path is a directory, append `index.html`.
     *
     * This is useful for static sites.
     *
     * Defaults to `true`.
     */
    public appendIndexHtmlOnDirectories(append: boolean): this {
        if (this.variant.inner.type === "directory") {
            this.variant.inner.appendIndexHtmlOnDirectories = append;
        }

        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed gzip
     * version of _any_ file in the directory.
     *
     * Assuming the `dir` directory is being served and `dir/foo.txt` is
     * requested, a client with an `Accept-Encoding` header that allows the gzip
     * encoding will receive the file `dir/foo.txt.gz` instead of `dir/foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the directory. Different precompressed variants can be
     * combined.
     */
    public precompressedGzip(): this {
        this.precompressedVariants.setGzip(true);
        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed brotli
     * version of _any_ file in the directory.
     *
     * Assuming the `dir` directory is being served and `dir/foo.txt` is
     * requested, a client with an `Accept-Encoding` header that allows the
     * brotli encoding will receive the file `dir/foo.txt.br` instead of
     * `dir/foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the directory. Different precompressed variants can be
     * combined.
     */
    public precompressedBr(): this {
        this.precompressedVariants.setBr(true);
        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed deflate
     * version of _any_ file in the directory.
     *
     * Assuming the `dir` directory is being served and `dir/foo.txt` is
     * requested, a client with an `Accept-Encoding` header that allows the
     * deflate encoding will receive the file `dir/foo.txt.zz` instead of
     * `dir/foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the directory. Different precompressed variants can be
     * combined.
     */
    public precompressedDeflate(): this {
        this.precompressedVariants.setDeflate(true);
        return this;
    }

    /**
     * Informs the service that it should also look for a precompressed zstd
     * version of _any_ file in the directory.
     *
     * Assuming the `dir` directory is being served and `dir/foo.txt` is
     * requested, a client with an `Accept-Encoding` header that allows the
     * deflate encoding will receive the file `dir/foo.txt.zst` instead of
     * `dir/foo.txt`.
     *
     * If the precompressed file is not available, or the client doesn't support
     * it, the uncompressed version will be served instead. Both the
     * precompressed version and the uncompressed version are expected to be
     * present in the directory. Different precompressed variants can be
     * combined.
     */
    public precompressedZstd(): this {
        this.precompressedVariants.setZstd(true);
        return this;
    }

    /**
     * Sets the fallback service.
     *
     * This service will be called if there is no file at the path of the
     * request.
     *
     * The status code returned by the fallback will not be altered. Use
     * {@link notFoundService} to set a fallback and always respond with a
     * `404 Not Found`.
     *
     * @example
     * ```ts
     * import {ServeDir, ServeFile} from "@taxum/fs";
     *
     * const service = new ServeDir("assets")
     *     // respond with a `not_found.html` for missing files
     *     .fallback(new ServeFile("assets/not_found.html"));
     * ```
     */
    public fallback(fallback: HttpService): this {
        this.fallback_ = fallback;
        return this;
    }

    /**
     * Sets the fallback service and overrides the fallback's status code to
     * `404 Not Found`.
     *
     * This service will be called if there is no file at the path of the
     * request.
     *
     * @example
     * ```ts
     * import {ServeDir, ServeFile} from "@taxum/fs";
     *
     * const service = new ServeDir("assets")
     *     // respond with `404 Not Found` and the contents of
     *     // `not_found.html` for missing files
     *     .notFoundService(new ServeFile("assets/not_found.html"));
     * ```
     */
    public notFoundService(fallback: HttpService): this {
        this.fallback_ = new SetStatusLayer(StatusCode.NOT_FOUND).layer(fallback);
        return this;
    }

    /**
     * Customizes whether to call the fallback for requests that aren't `GET` or
     * `HEAD`.
     *
     * Defaults to not calling the fallback and instead returning
     * `405 Method Not Allowed`.
     */
    public callFallbackOnMethodNotAllowed(callFallback: boolean): this {
        this.callFallbackOnMethodNotAllowed_ = callFallback;
        return this;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        try {
            return await this.tryInvoke(req);
        } catch (error) {
            getGlobalLogger().error("Failed to read file", error);
            return StatusCode.INTERNAL_SERVER_ERROR[TO_HTTP_RESPONSE]();
        }
    }

    private async tryInvoke(req: HttpRequest): Promise<HttpResponse> {
        if (!(req.method.equals(Method.GET) || req.method.equals(Method.HEAD))) {
            if (this.fallback_ && this.callFallbackOnMethodNotAllowed_) {
                return this.fallback_.invoke(req);
            }

            return StatusCode.METHOD_NOT_ALLOWED[TO_HTTP_RESPONSE]();
        }

        const pathToFile = this.variant.buildAndValidatePath(this.base, req.uri.pathname);

        if (!pathToFile) {
            return this.handleNotFound(req);
        }

        const rangeHeader = req.headers.get("range");
        const negotiatedEncoding = encodings(req.headers, this.precompressedVariants);

        let output: OpenFileOutput;

        try {
            output = await openFile(this.variant, pathToFile, req, negotiatedEncoding, rangeHeader);
        } catch (error) {
            if (!isErrnoException(error)) {
                throw error;
            }

            if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EACCESS") {
                return this.handleNotFound(req);
            }

            throw error;
        }

        switch (output.type) {
            case "file_opened":
                return buildResponse(output);

            case "redirect":
                return HttpResponse.builder()
                    .status(StatusCode.TEMPORARY_REDIRECT)
                    .header("location", output.location)
                    .body(null);

            case "file_not_found":
                return this.handleNotFound(req);

            case "precondition_failed":
                return StatusCode.PRECONDITION_FAILED[TO_HTTP_RESPONSE]();

            case "not_modified":
                return StatusCode.NOT_MODIFIED[TO_HTTP_RESPONSE]();
        }
    }

    private async handleNotFound(req: HttpRequest): Promise<HttpResponse> {
        if (this.fallback_) {
            return this.fallback_.invoke(req);
        }

        return StatusCode.NOT_FOUND[TO_HTTP_RESPONSE]();
    }
}

const buildResponse = (output: OpenFileOutput & { type: "file_opened" }): HttpResponse => {
    const builder = HttpResponse.builder()
        .header("content-type", output.mime)
        .header("accept-ranges", "bytes")
        .header("last-modified", output.lastModified.toUTCString());

    if (output.encoding !== null && output.encoding !== Encoding.IDENTITY) {
        builder.header("content-encoding", output.encoding.value);
    }

    const { size } = output.extent.stats;

    if (output.range === null) {
        builder.header("content-length", size.toString());

        if (output.extent.type === "head") {
            return builder.body(null);
        }

        return builder.body(output.extent.file.createReadStream());
    }

    if (output.range instanceof Error) {
        return builder
            .header("content-range", `bytes */${size}`)
            .status(StatusCode.RANGE_NOT_SATISFIABLE)
            .body(null);
    }

    if (output.range.length === 0) {
        return builder
            .header("content-range", `bytes */${size}`)
            .status(StatusCode.RANGE_NOT_SATISFIABLE)
            .body("No range found after parsing range header, please file an issue");
    }

    if (output.range.length > 1) {
        return builder
            .header("content-range", `bytes */${size}`)
            .status(StatusCode.RANGE_NOT_SATISFIABLE)
            .body("Cannot serve multipart range requests");
    }

    const { start, end } = output.range[0];
    const contentLength = size === 0 ? 0 : end - start + 1;

    builder
        .header("content-range", `bytes ${start}-${end}/${size}`)
        .header("content-length", contentLength.toString())
        .status(StatusCode.PARTIAL_CONTENT);

    if (output.extent.type === "head") {
        return builder.body(null);
    }

    return builder.body(output.extent.file.createReadStream({ start, end }));
};

export class PrecompressedVariants implements SupportedEncodings {
    private gzip_ = false;
    private deflate_ = false;
    private br_ = false;
    private zstd_ = false;

    public gzip(): boolean {
        return this.gzip_;
    }

    public setGzip(enable: boolean): void {
        this.gzip_ = enable;
    }

    public deflate(): boolean {
        return this.deflate_;
    }

    public setDeflate(enable: boolean): void {
        this.deflate_ = enable;
    }

    public br(): boolean {
        return this.br_;
    }

    public setBr(enable: boolean): void {
        this.br_ = enable;
    }

    public zstd(): boolean {
        return this.zstd_;
    }

    public setZstd(enable: boolean): void {
        this.zstd_ = enable;
    }
}

export type DirectoryServeVariant = {
    type: "directory";
    appendIndexHtmlOnDirectories: boolean;
};

export type SingleFileServeVariant = {
    type: "single_file";
    mime: string;
};

export type InnerServeVariant = DirectoryServeVariant | SingleFileServeVariant;

export class ServeVariant {
    public inner: InnerServeVariant;

    private constructor(inner: InnerServeVariant) {
        this.inner = inner;
    }

    public static directory(appendIndexHtmlOnDirectories: boolean): ServeVariant {
        return new ServeVariant({
            type: "directory",
            appendIndexHtmlOnDirectories,
        });
    }

    public static singleFile(mime: string): ServeVariant {
        return new ServeVariant({
            type: "single_file",
            mime,
        });
    }

    public buildAndValidatePath(basePath: string, requestedPath: string): string | null {
        if (this.inner.type === "single_file") {
            return basePath;
        }

        const trimmedPath = requestedPath.replace(/^\/+/, "");
        const decodedPath = decodeURIComponent(trimmedPath);
        const parts = decodedPath.split(/[\\/]+/).filter(Boolean);
        let pathToFile = basePath;

        for (const part of parts) {
            if (part === "." || part === ".." || /^[A-Za-z]:/.test(part)) {
                return null;
            }

            pathToFile = Path.join(pathToFile, part);
        }

        return pathToFile;
    }
}
