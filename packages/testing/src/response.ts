import consumers from "node:stream/consumers";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { HttpResponse, type HttpResponseLike } from "@taxum/core/http";
import type { SseEvent } from "@taxum/core/sse";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);
const zstdDecompress = "zstdDecompress" in zlib ? promisify(zlib.zstdDecompress) : null;

/**
 * Options for {@link TestResponse.sseEvents}.
 */
export type SseEventsOptions = {
    /**
     * Yields comment-only blocks (e.g. keep-alive pings) as events with only
     * the `comment` field set, and includes comments on regular events.
     * Defaults to `false`, where comments are skipped entirely.
     */
    comments?: boolean;
};

/**
 * A fetch-flavored reading interface over an {@link HttpResponse}.
 *
 * Exposes the status as a plain number and the headers as a native
 * {@link !Headers} snapshot, so assertions work with any assertion library
 * without importing taxum types. The underlying {@link HttpResponse} remains
 * available via {@link TestResponse.inner} for asserting on extensions, the
 * `StatusCode`, or exact multi-value headers.
 *
 * Unlike fetch, the body readers are repeatable: the body is buffered on
 * first read, so `text()`, `json()`, and `arrayBuffer()` can be called any
 * number of times and combined. Bodies are transparently decompressed based
 * on the `content-encoding` response header.
 *
 * {@link TestResponse.sseEvents} is the streaming exception: it consumes the
 * body incrementally and is mutually exclusive with the buffered readers.
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
    private streamingBody = false;

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

    /**
     * Consumes the body as a Server-Sent-Events stream, yielding one
     * {@link SseEvent} per event block.
     *
     * Multi-line `data:` fields are reassembled with `\n`, and `event`,
     * `id`, and `retry` are surfaced. Comment lines are skipped unless
     * {@link SseEventsOptions.comments} is enabled. Blocks that set no
     * field (after comment filtering) yield nothing, so keep-alive pings
     * are invisible by default.
     *
     * Breaking out of the loop cancels the underlying body stream, which a
     * streaming handler observes the same way as a client disconnect. Drain
     * the iterator or break out of it; a generator abandoned mid-stream
     * keeps the body locked and the handler running.
     *
     * Mutually exclusive with the buffered readers (`text()` etc.): calling
     * this method commits the response to streaming, even before iteration
     * starts. The body is read raw, without content-encoding decompression.
     */
    public sseEvents(options?: SseEventsOptions): AsyncGenerator<SseEvent, void, undefined> {
        if (this.bufferedBody !== null) {
            throw new Error(
                "The body has already been buffered; sseEvents() requires the unconsumed stream",
            );
        }

        if (this.streamingBody) {
            throw new Error("The SSE stream is already being consumed");
        }

        this.streamingBody = true;
        return this.streamEvents(options?.comments ?? false);
    }

    private async *streamEvents(
        includeComments: boolean,
    ): AsyncGenerator<SseEvent, void, undefined> {
        const reader = this.inner.body.readable.getReader();
        const parser = new SseParser(includeComments);

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                yield* parser.push(value);
            }

            yield* parser.end();
        } finally {
            reader.cancel().catch(() => {
                // Cancellation failures of a discarded stream are of no interest.
            });
        }
    }

    private buffered(): Promise<Buffer> {
        if (this.streamingBody) {
            throw new Error("The body is being consumed as an SSE stream");
        }

        this.bufferedBody ??= this.readAndDecode();
        return this.bufferedBody;
    }

    private async readAndDecode(): Promise<Buffer> {
        const raw = await consumers.buffer(this.inner.body.readable);
        return decodeBody(raw, this.headers.get("content-encoding"));
    }
}

type SseBlock = {
    comments: string[];
    event?: string;
    dataLines: string[];
    id?: string;
    retry?: number;
};

const emptyBlock = (): SseBlock => ({ comments: [], dataLines: [] });

/**
 * Incremental parser for the SSE wire format: bytes in, complete
 * {@link SseEvent}s out.
 */
class SseParser {
    private readonly includeComments: boolean;
    private readonly decoder = new TextDecoder();
    private buffer = "";
    private block = emptyBlock();

    public constructor(includeComments: boolean) {
        this.includeComments = includeComments;
    }

    public push(chunk: Uint8Array): SseEvent[] {
        this.buffer += this.decoder.decode(chunk, { stream: true });

        const [lines, rest] = extractLines(this.buffer);
        this.buffer = rest;

        const events: SseEvent[] = [];

        for (const line of lines) {
            const event = this.processLine(line);

            if (event !== null) {
                events.push(event);
            }
        }

        return events;
    }

    /**
     * Flushes the stream end. A trailing CR is a valid terminator for a
     * blank (dispatching) line; anything else left in the buffer is an
     * incomplete line or block, which the SSE specification discards.
     */
    public end(): SseEvent[] {
        if (this.buffer !== "\r") {
            return [];
        }

        const event = this.processLine("");
        return event !== null ? [event] : [];
    }

    private processLine(line: string): SseEvent | null {
        if (line === "") {
            const event = dispatchBlock(this.block, this.includeComments);
            this.block = emptyBlock();
            return event;
        }

        processFieldLine(line, this.block);
        return null;
    }
}

/**
 * Splits off the complete lines in `buffer` (terminated by `\n`, `\r`, or
 * `\r\n`), returning them and the unterminated rest. A trailing `\r` is held
 * back, as it may be the first half of a `\r\n` split across chunks.
 */
const extractLines = (buffer: string): [string[], string] => {
    const lines: string[] = [];
    let start = 0;
    let index = 0;

    while (index < buffer.length) {
        const char = buffer[index];

        if (char === "\n") {
            lines.push(buffer.slice(start, index));
            start = index + 1;
            index = start;
        } else if (char === "\r") {
            if (index + 1 >= buffer.length) {
                break;
            }

            lines.push(buffer.slice(start, index));
            start = buffer[index + 1] === "\n" ? index + 2 : index + 1;
            index = start;
        } else {
            index++;
        }
    }

    return [lines, buffer.slice(start)];
};

/**
 * Processes one non-blank line per the SSE parsing algorithm, mutating the
 * current block.
 */
const processFieldLine = (line: string, block: SseBlock): void => {
    if (line.startsWith(":")) {
        block.comments.push(stripLeadingSpace(line.slice(1)));
        return;
    }

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : stripLeadingSpace(line.slice(colon + 1));

    switch (field) {
        case "event": {
            block.event = value;
            break;
        }

        case "data": {
            block.dataLines.push(value);
            break;
        }

        case "id": {
            if (!value.includes("\0")) {
                block.id = value;
            }

            break;
        }

        case "retry": {
            if (/^\d+$/.test(value)) {
                block.retry = Number.parseInt(value, 10);
            }

            break;
        }

        default: {
            // Unknown fields are ignored per the SSE specification.
            break;
        }
    }
};

const dispatchBlock = (block: SseBlock, includeComments: boolean): SseEvent | null => {
    const event: SseEvent = {};

    if (includeComments && block.comments.length > 0) {
        event.comment = block.comments.join("\n");
    }

    if (block.event !== undefined) {
        event.event = block.event;
    }

    if (block.dataLines.length > 0) {
        event.data = block.dataLines.join("\n");
    }

    if (block.id !== undefined) {
        event.id = block.id;
    }

    if (block.retry !== undefined) {
        event.retry = block.retry;
    }

    return Object.keys(event).length > 0 ? event : null;
};

const stripLeadingSpace = (value: string): string =>
    value.startsWith(" ") ? value.slice(1) : value;

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
            /* node:coverage ignore next 3 */
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
