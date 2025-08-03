import assert from "node:assert";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { HeaderMap } from "./headers.js";
import { HttpResponse, type ToHttpResponse } from "./response.js";
import { SizeHint } from "./size-hint.js";
import { StatusCode } from "./status.js";

/**
 * Represents the body of an HTTP message, allowing for handling of various body
 * types like streams, strings, buffers, and more.
 *
 * Provides utilities for creating a body instance and transforming it into an
 * HTTP response.
 */
export class Body implements ToHttpResponse {
    public readonly sizeHint: SizeHint;
    public readonly contentTypeHint: string | null;
    private readonly inner: Readable;

    public constructor(stream: Readable, sizeHint?: SizeHint, contentTypeHint?: string) {
        assert(stream.readable, "Body must be readable");

        this.inner = stream;
        this.sizeHint = sizeHint ?? SizeHint.unbounded();
        this.contentTypeHint = contentTypeHint ?? null;
    }

    public static from(body: BodyLike): Body {
        if (body === null) {
            return new Body(Readable.from([]), SizeHint.exact(0));
        }

        if (body instanceof Body) {
            return body;
        }

        if (body instanceof Readable) {
            return new Body(body, SizeHint.unbounded(), "application/octet-stream");
        }

        if (typeof body === "string") {
            return new Body(
                Readable.from(body),
                SizeHint.exact(Buffer.byteLength(body)),
                "text/plain; charset=utf-8",
            );
        }

        if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
            return new Body(
                Readable.from(body),
                SizeHint.exact(body.length),
                "application/octet-stream",
            );
        }

        return new Body(Readable.fromWeb(body), SizeHint.unbounded(), "application/octet-stream");
    }

    /**
     * Retrieves the readable stream from the inner body if it has not been
     * consumed.
     *
     * Ensures that the body is readable before accessing it.
     *
     * @throws {Error} if the body has already been consumed.
     */
    public read(): Readable {
        assert(this.inner.readable, "Body has already been consumed");
        return this.inner;
    }

    public toHttpResponse(): HttpResponse {
        const headers = new HeaderMap();

        if (this.contentTypeHint) {
            headers.insert("content-type", this.contentTypeHint);
        }

        return new HttpResponse(StatusCode.OK, headers, this);
    }
}

/**
 * Represents any value that can be treated as a body payload in HTTP response
 * handling.
 *
 * This type is a union of various formats that a body can take, enabling
 * flexibility in providing content.
 *
 * - {@link Body}: An object that represents the body of a `Response`.
 * - `string`: A text-based representation of the body content.
 * - `Buffer`: A binary buffer containing the body data.
 * - `Uint8Array`: A byte array containing the body data in binary form.
 * - `Readable`: A Node.js Readable stream.
 * - `ReadableStream`: A web-standard ReadableStream.
 * - `null`: Represents an absent or empty body.
 *
 * String bodies will by default have a content-type of `text/plain`, while
 * byte-input like `Buffer` or `Readable` will default to
 * `application/octet-stream`.
 */
export type BodyLike = Body | string | Buffer | Uint8Array | Readable | ReadableStream | null;

export const isBodyLike = (value: unknown): value is BodyLike => {
    return (
        value instanceof Body ||
        typeof value === "string" ||
        Buffer.isBuffer(value) ||
        value instanceof Uint8Array ||
        value instanceof Readable ||
        value instanceof ReadableStream ||
        value === null
    );
};
