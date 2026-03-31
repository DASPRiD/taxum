import { Body } from "../http/body.js";
import { HeaderMap } from "../http/headers.js";
import { HttpResponse } from "../http/response.js";
import { SizeHint } from "../http/size-hint.js";
import { StatusCode } from "../http/status.js";
import { TO_HTTP_RESPONSE, type ToHttpResponse } from "../http/to-response.js";
import { type SseEvent, serializeSseEvent } from "./event.js";

/**
 * Options for configuring SSE keep-alive behavior.
 */
export type SseKeepAliveOptions = {
    /**
     * The interval in milliseconds between keep-alive messages.
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
     */
    public keepAlive(options?: SseKeepAliveOptions): this {
        this.keepAliveOptions = {
            interval: options?.interval ?? 15_000,
            comment: options?.comment ?? "",
        };
        return this;
    }

    public [TO_HTTP_RESPONSE](): HttpResponse {
        const headers = new HeaderMap();
        headers.insert("content-type", "text/event-stream");
        headers.insert("cache-control", "no-cache");
        headers.insert("connection", "keep-alive");

        const byteStream = this.createByteStream();
        const body = new Body(byteStream, SizeHint.unbounded());

        return new HttpResponse(StatusCode.OK, headers, body);
    }

    private createByteStream(): ReadableStream<Uint8Array> {
        const source = this.stream;
        const keepAlive = this.keepAliveOptions;

        if (!keepAlive) {
            return source.pipeThrough(
                new TransformStream<SseEvent, Uint8Array>({
                    transform(event, controller) {
                        controller.enqueue(serializeSseEvent(event));
                    },
                }),
            );
        }

        const interval = keepAlive.interval;
        const keepAliveBytes = serializeSseEvent({ comment: keepAlive.comment });
        let timer: ReturnType<typeof setInterval> | undefined;
        const reader = source.getReader();

        return new ReadableStream<Uint8Array>({
            start(controller) {
                const resetTimer = (): void => {
                    if (timer !== undefined) {
                        clearInterval(timer);
                    }

                    timer = setInterval(() => {
                        controller.enqueue(keepAliveBytes);
                    }, interval);
                };

                const pump = (): void => {
                    reader
                        .read()
                        .then(({ done, value }) => {
                            if (done) {
                                if (timer !== undefined) {
                                    clearInterval(timer);
                                }

                                controller.close();
                                return;
                            }

                            controller.enqueue(serializeSseEvent(value));
                            resetTimer();
                            pump();
                        })
                        .catch((error: unknown) => {
                            if (timer !== undefined) {
                                clearInterval(timer);
                            }

                            controller.error(error);
                        });
                };

                resetTimer();
                pump();
            },
            cancel() {
                if (timer !== undefined) {
                    clearInterval(timer);
                }

                reader.cancel().catch(() => {
                    // Ignore cancel errors
                });
            },
        });
    }
}
