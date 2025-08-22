import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { HeaderMap } from "./headers.js";
import { HttpResponse } from "./response.js";
import { SizeHint } from "./size-hint.js";
import { StatusCode } from "./status.js";
import { TO_HTTP_RESPONSE, type ToHttpResponse } from "./to-response.js";

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
    public readonly readable: ReadableStream<Uint8Array>;

    /**
     * Creates a new {@link Body}.
     *
     * @throws {@link !Error} if the provided stream is not readable.
     */
    public constructor(
        stream: ReadableStream<Uint8Array>,
        sizeHint?: SizeHint,
        contentTypeHint?: string,
    ) {
        this.readable = stream;
        this.sizeHint = sizeHint ?? SizeHint.unbounded();
        this.contentTypeHint = contentTypeHint ?? null;
    }

    /**
     * Creates a new {@link Body} from a {@link BodyLike} value.
     */
    public static from(body: BodyLike): Body {
        if (body === null) {
            return new Body(
                new ReadableStream({
                    start: (controller) => {
                        controller.close();
                    },
                }),
                SizeHint.exact(0),
            );
        }

        if (body instanceof Body) {
            return body;
        }

        if (body instanceof Readable) {
            return new Body(Readable.toWeb(body), SizeHint.unbounded(), "application/octet-stream");
        }

        if (typeof body === "string") {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(body);

            return new Body(
                new ReadableStream({
                    start: (controller) => {
                        controller.enqueue(bytes);
                        controller.close();
                    },
                }),
                SizeHint.exact(Buffer.byteLength(body)),
                "text/plain; charset=utf-8",
            );
        }

        if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
            return new Body(
                new ReadableStream({
                    start: (controller) => {
                        controller.enqueue(body);
                        controller.close();
                    },
                }),
                SizeHint.exact(body.length),
                "application/octet-stream",
            );
        }

        return new Body(body, SizeHint.unbounded(), "application/octet-stream");
    }

    public [TO_HTTP_RESPONSE](): HttpResponse {
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
 * - `Readable`: A Node.js Readable stream yielding Uint8Array chunks.
 * - `ReadableStream`: A web-standard ReadableStream.
 * - `null`: Represents an absent or empty body.
 *
 * String bodies will by default have a content-type of `text/plain`, while
 * byte-input like `Buffer` or `Readable` will default to
 * `application/octet-stream`.
 */
export type BodyLike =
    | Body
    | string
    | Buffer
    | Uint8Array
    | Readable
    | ReadableStream<Uint8Array>
    | null;

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
