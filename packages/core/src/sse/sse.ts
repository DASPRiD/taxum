import { HttpResponse } from "../http/response.js";
import { TO_HTTP_RESPONSE, type ToHttpResponse } from "../http/to-response.js";
import { getLoggerProxy } from "../logging/index.js";
import { type SseEvent, serializeSseEvent } from "./event.js";

/**
 * Options for configuring SSE keep-alive behavior.
 */
export type SseKeepAliveOptions = {
    /**
     * The interval in milliseconds between keep-alive messages.
     *
     * Must be a positive finite number.
     *
     * @defaultValue 15000
     */
    interval?: number;

    /**
     * The comment text to send as a keep-alive message.
     *
     * @defaultValue "" (empty comment)
     */
    comment?: string;
};

/**
 * A Server-Sent Events (SSE) response.
 *
 * Wraps a stream of {@link SseEvent} objects and implements {@link ToHttpResponse} to produce a
 * streaming HTTP response with the correct headers for SSE.
 *
 * Accepts either a `ReadableStream<SseEvent>` or any `AsyncIterable<SseEvent>` (including async
 * generators).
 *
 * An instance is single-use: converting it into a response consumes the underlying stream, so a
 * new instance must be created for each request.
 *
 * @example Using an async generator:
 * ```ts
 * import { Sse, type SseEvent } from "@taxum/core/sse";
 *
 * const handler = () => {
 *     async function* events(): AsyncGenerator<SseEvent> {
 *         yield { data: "hello" };
 *         yield { data: "world" };
 *     }
 *
 *     return new Sse(events());
 * };
 * ```
 *
 * @example With keep-alive to prevent proxy timeouts:
 * ```ts
 * const handler = () => new Sse(events()).keepAlive();
 * ```
 */
export class Sse implements ToHttpResponse {
    private readonly stream: ReadableStream<SseEvent>;
    private keepAliveOptions: Required<SseKeepAliveOptions> | undefined;
    private converted = false;

    /**
     * Creates a new {@link Sse} response from a stream of events.
     */
    public constructor(stream: ReadableStream<SseEvent> | AsyncIterable<SseEvent>) {
        this.stream = stream instanceof ReadableStream ? stream : ReadableStream.from(stream);
    }

    /**
     * Enables keep-alive messages to prevent proxy and load balancer timeouts.
     *
     * When enabled, a comment line is sent at the configured interval whenever the stream has not
     * produced an event. This keeps the connection alive without triggering client-side event
     * handlers.
     *
     * @param options - Optional configuration for keep-alive behavior.
     * @throws {@link !Error} if the interval is not a positive finite number, or if the instance
     *         was already converted into a response.
     */
    public keepAlive(options?: SseKeepAliveOptions): this {
        if (this.converted) {
            throw new Error(
                "keepAlive() must be called before the Sse is converted into a response",
            );
        }

        const interval = options?.interval ?? 15_000;

        if (!Number.isFinite(interval) || interval <= 0) {
            throw new Error(
                `Keep-alive interval must be a positive finite number of milliseconds, got: ${interval}`,
            );
        }

        this.keepAliveOptions = {
            interval,
            comment: options?.comment ?? "",
        };
        return this;
    }

    /**
     * @throws {@link !Error} if the instance was already converted into a response.
     */
    public [TO_HTTP_RESPONSE](): HttpResponse {
        if (this.converted) {
            throw new Error(
                "An Sse instance can only be converted into a response once; create a new instance for each request",
            );
        }

        this.converted = true;

        return HttpResponse.builder()
            .header("content-type", "text/event-stream")
            .header("cache-control", "no-cache")
            .body(this.createByteStream());
    }

    private createByteStream(): ReadableStream<Uint8Array> {
        const serialized = this.stream.pipeThrough(
            new TransformStream<SseEvent, Uint8Array>({
                transform: (event, controller) => {
                    try {
                        controller.enqueue(serializeSseEvent(event));
                    } catch (error) {
                        // The response headers are already sent when this happens, so the error
                        // only surfaces as an aborted connection; logging is the sole signal
                        // pointing at the invalid event.
                        getLoggerProxy().error("Failed to serialize SSE event", { error });
                        throw error;
                    }
                },
            }),
        );

        if (!this.keepAliveOptions) {
            return serialized;
        }

        return createKeepAliveStream(serialized, this.keepAliveOptions);
    }
}

const createKeepAliveStream = (
    source: ReadableStream<Uint8Array>,
    options: Required<SseKeepAliveOptions>,
): ReadableStream<Uint8Array> => {
    const keepAliveBytes = serializeSseEvent({ comment: options.comment });
    const reader = source.getReader();
    let timer: ReturnType<typeof setInterval> | undefined;

    return new ReadableStream<Uint8Array>(
        {
            pull: async (controller) => {
                if (timer === undefined) {
                    // Arming on the first pull rather than at construction keeps the timer from
                    // running until the body is actually read. A converted but never consumed
                    // response is never pulled, so it leaves no interval behind.
                    timer = setInterval(() => {
                        // Only enqueue while the queue is drained (desiredSize is zero under a
                        // high water mark of zero); a stalled consumer must not accumulate a
                        // backlog of keep-alives.
                        if ((controller.desiredSize ?? -1) >= 0) {
                            controller.enqueue(keepAliveBytes);
                        }
                    }, options.interval);
                }

                const result = await reader.read().catch((error: unknown) => {
                    clearInterval(timer);
                    throw error;
                });

                if (result.done) {
                    clearInterval(timer);
                    controller.close();
                    return;
                }

                controller.enqueue(result.value);
                timer.refresh();
            },
            cancel: async (reason) => {
                clearInterval(timer);
                await reader.cancel(reason);
            },
        },
        // A high water mark of zero keeps pull from firing until the consumer reads, which is
        // what makes the keep-alive timer lazy.
        { highWaterMark: 0 },
    );
};
