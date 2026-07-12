import consumers from "node:stream/consumers";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { HttpResponse, type HttpResponseLike } from "@taxum/core/http";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);
const zstdDecompress = "zstdDecompress" in zlib ? promisify(zlib.zstdDecompress) : null;

/**
 * A fetch-flavored reading interface over an {@link HttpResponse}.
 *
 * Exposes the status as a plain number and the headers as a native
 * {@link !Headers} snapshot, so assertions work with any assertion library
 * without importing taxum types. The underlying {@link HttpResponse} remains
 * available via {@link TestResponse.inner} for asserting on extensions, the
 * {@link StatusCode}, or exact multi-value headers.
 *
 * Unlike fetch, the body readers are repeatable: the body is buffered on
 * first read, so `text()`, `json()`, and `arrayBuffer()` can be called any
 * number of times and combined. Bodies are transparently decompressed based
 * on the `content-encoding` response header.
 *
 * A `transfer-encoding` header never appears: chunked framing is applied by
 * Node when writing to a real connection, which in-process tests never do.
 */
export class TestResponse {
    /**
     * The underlying {@link HttpResponse}.
     */
    public readonly inner: HttpResponse;

    /**
     * Response headers as a native {@link !Headers} snapshot.
     *
     * Repeated `set-cookie` headers are accessible via
     * {@link !Headers.getSetCookie}. Other repeated headers are joined with a
     * comma on read, matching fetch semantics; use
     * `inner.headers.getAll(name)` when the individual values matter.
     *
     * Headers the WHATWG {@link !Headers} type rejects (e.g. values with
     * control characters) are omitted from the snapshot; `inner.headers`
     * always holds the unfiltered response headers.
     */
    public readonly headers: Headers;

    private bufferedBody: Promise<Buffer> | null = null;

    private constructor(inner: HttpResponse) {
        this.inner = inner;
        this.headers = new Headers();

        for (const [name, value] of inner.headers.entries()) {
            try {
                this.headers.append(name, value.value);
            } catch {
                // The native Headers type rejects names/values taxum allows
                // (e.g. control characters); those stay visible via `inner`.
            }
        }
    }

    /**
     * Creates a new {@link TestResponse} from anything a handler may return.
     *
     * Accepts the same values as {@link HttpResponse.from}, so a bare
     * handler's return value can be wrapped directly:
     *
     * ```ts
     * const res = TestResponse.from(await myHandler(req));
     * assert.equal(res.status, 200);
     * ```
     */
    public static from(response: HttpResponseLike): TestResponse {
        return new TestResponse(HttpResponse.from(response));
    }

    /**
     * The response status code as a plain number.
     */
    public get status(): number {
        return this.inner.status.code;
    }

    /**
     * Reads the body as a UTF-8 string.
     */
    public async text(): Promise<string> {
        return (await this.buffered()).toString("utf-8");
    }

    /**
     * Reads the body and parses it as JSON.
     */
    public async json<T = unknown>(): Promise<T> {
        return JSON.parse(await this.text()) as T;
    }

    /**
     * Reads the body as an {@link !ArrayBuffer}.
     */
    public async arrayBuffer(): Promise<ArrayBuffer> {
        const buffer = await this.buffered();
        const copy = new Uint8Array(buffer.byteLength);
        copy.set(buffer);
        return copy.buffer;
    }

    private buffered(): Promise<Buffer> {
        this.bufferedBody ??= this.readAndDecode();
        return this.bufferedBody;
    }

    private async readAndDecode(): Promise<Buffer> {
        const raw = await consumers.buffer(this.inner.body.readable);
        return decodeBody(raw, this.headers.get("content-encoding"));
    }
}

const decodeBody = async (raw: Buffer, contentEncoding: string | null): Promise<Buffer> => {
    if (contentEncoding === null) {
        return raw;
    }

    const encodings = contentEncoding
        .split(",")
        .map((encoding) => encoding.trim().toLowerCase())
        .filter((encoding) => encoding !== "")
        .reverse();

    let decoded = raw;

    for (const encoding of encodings) {
        decoded = await decodeSingle(decoded, encoding);
    }

    return decoded;
};

const decodeSingle = async (raw: Buffer, encoding: string): Promise<Buffer> => {
    switch (encoding) {
        case "identity": {
            return raw;
        }

        case "gzip":
        case "x-gzip": {
            return gunzip(raw);
        }

        case "deflate": {
            return inflate(raw);
        }

        case "br": {
            return brotliDecompress(raw);
        }

        case "zstd": {
            if (zstdDecompress === null) {
                throw new Error("zstd decompression is not supported by this Node.js version");
            }

            return zstdDecompress(raw);
        }

        default: {
            throw new Error(`Unsupported content encoding: ${encoding}`);
        }
    }
};
