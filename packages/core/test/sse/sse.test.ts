import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { TO_HTTP_RESPONSE } from "../../src/http/index.js";
import { Sse, type SseEvent } from "../../src/sse/index.js";

const collectStream = async (sse: Sse): Promise<string> => {
    const response = sse[TO_HTTP_RESPONSE]();
    return consumers.text(response.body.readable);
};

const withTimeout = async (promise: Promise<void>, ms: number, message: string): Promise<void> =>
    Promise.race([
        promise,
        delay(ms).then(() => {
            throw new Error(message);
        }),
    ]);

type StreamControl = {
    stream: ReadableStream<SseEvent>;
    enqueue: (event: SseEvent) => void;
    close: () => void;
};

const createControllableStream = (): StreamControl => {
    let enqueue: ((event: SseEvent) => void) | undefined;
    let close: (() => void) | undefined;

    const stream = new ReadableStream<SseEvent>({
        start: (controller) => {
            enqueue = (event) => controller.enqueue(event);
            close = () => controller.close();
        },
    });

    assert(enqueue);
    assert(close);

    return { stream, enqueue, close };
};

describe("sse:Sse", () => {
    describe("response headers", () => {
        it("sets content-type to text/event-stream", () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.headers.get("content-type")?.value, "text/event-stream");
        });

        it("sets cache-control to no-cache", () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.headers.get("cache-control")?.value, "no-cache");
        });

        it("does not set a connection header", () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.headers.get("connection"), null);
        });

        it("returns 200 OK status", () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.status.code, 200);
        });
    });

    describe("single use", () => {
        it("throws when converted twice", () => {
            const sse = new Sse(
                new ReadableStream<SseEvent>({
                    start: (controller) => {
                        controller.close();
                    },
                }),
            );

            sse[TO_HTTP_RESPONSE]();
            assert.throws(() => sse[TO_HTTP_RESPONSE](), /only be converted into a response once/);
        });

        it("throws when keepAlive is called after conversion", () => {
            const sse = new Sse(
                new ReadableStream<SseEvent>({
                    start: (controller) => {
                        controller.close();
                    },
                }),
            );

            sse[TO_HTTP_RESPONSE]();
            assert.throws(() => sse.keepAlive(), /before the Sse is converted/);
        });
    });

    describe("async iterable support", () => {
        it("accepts an async generator", async () => {
            async function* events(): AsyncGenerator<SseEvent> {
                yield { data: "one" };
                yield { data: "two" };
            }

            const result = await collectStream(new Sse(events()));
            assert.equal(result, "data: one\n\ndata: two\n\n");
        });

        it("handles an empty async generator", async () => {
            async function* events(): AsyncGenerator<SseEvent> {
                // yields nothing
            }

            const result = await collectStream(new Sse(events()));
            assert.equal(result, "");
        });

        it("works with keep-alive", async () => {
            async function* events(): AsyncGenerator<SseEvent> {
                yield { data: "hello" };
            }

            const sse = new Sse(events()).keepAlive({ interval: 50 });
            const result = await collectStream(sse);
            assert.equal(result, "data: hello\n\n");
        });
    });

    describe("stream transformation", () => {
        it("transforms a single event to bytes", async () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.enqueue({ data: "hello" });
                    controller.close();
                },
            });

            const result = await collectStream(new Sse(stream));
            assert.equal(result, "data: hello\n\n");
        });

        it("transforms multiple events to bytes", async () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.enqueue({ event: "msg", data: "first" });
                    controller.enqueue({ event: "msg", id: "2", data: "second" });
                    controller.close();
                },
            });

            const result = await collectStream(new Sse(stream));
            assert.equal(result, "event: msg\ndata: first\n\nevent: msg\ndata: second\nid: 2\n\n");
        });

        it("handles an empty stream", async () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.close();
                },
            });

            const result = await collectStream(new Sse(stream));
            assert.equal(result, "");
        });

        it("propagates stream errors", async () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.error(new Error("stream failed"));
                },
            });

            await assert.rejects(() => collectStream(new Sse(stream)), {
                message: "stream failed",
            });
        });

        it("logs and cancels the source when an event fails to serialize", async (t) => {
            const spy = t.mock.method(console, "error", () => {
                // Suppress actual console.error output.
            });

            const { promise: cancellation, resolve: cancelled } = Promise.withResolvers<void>();

            const stream = new ReadableStream<SseEvent>({
                pull: (controller) => {
                    controller.enqueue({ retry: 1.5 });
                },
                cancel: () => {
                    cancelled();
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const reader = sse[TO_HTTP_RESPONSE]().body.readable.getReader();

            await assert.rejects(async () => {
                while (!(await reader.read()).done) {
                    // Drain until the serialization error surfaces.
                }
            });

            await withTimeout(cancellation, 500, "source was not cancelled");
            assert.match(spy.mock.calls[0].arguments[0], /Failed to serialize SSE event/i);
        });
    });

    describe("keep-alive", () => {
        it("sends keep-alive comment when stream is idle", async () => {
            const { stream, enqueue, close } = createControllableStream();

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            await delay(80);

            const { value: keepAliveChunk } = await reader.read();
            const decoded = new TextDecoder().decode(keepAliveChunk);
            assert.equal(decoded, ": \n\n");

            enqueue({ data: "test" });
            close();

            const { value: eventChunk } = await reader.read();
            assert.equal(new TextDecoder().decode(eventChunk), "data: test\n\n");

            const { done } = await reader.read();
            assert.equal(done, true);
        });

        it("uses custom keep-alive comment", async () => {
            const { stream, close } = createControllableStream();

            const sse = new Sse(stream).keepAlive({ interval: 50, comment: "ping" });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            await delay(80);

            const { value: keepAliveChunk } = await reader.read();
            assert.equal(new TextDecoder().decode(keepAliveChunk), ": ping\n\n");

            close();
            reader.cancel();
        });

        it("resets keep-alive timer when an event is sent", async () => {
            const { stream, enqueue, close } = createControllableStream();

            const sse = new Sse(stream).keepAlive({ interval: 100 });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            await delay(30);
            enqueue({ data: "early" });

            const { value: eventChunk } = await reader.read();
            assert.equal(new TextDecoder().decode(eventChunk), "data: early\n\n");

            // Wait less than the interval, so no keep-alive may fire before the close.
            await delay(50);
            close();

            const { done } = await reader.read();
            assert.equal(done, true);
        });

        it("rejects an invalid interval", () => {
            const stream = new ReadableStream<SseEvent>();

            for (const interval of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
                assert.throws(
                    () => new Sse(stream).keepAlive({ interval }),
                    /must be a positive finite number/,
                );
            }
        });

        it("respects backpressure from a slow consumer", async () => {
            let pullCount = 0;

            const stream = new ReadableStream<SseEvent>({
                pull: (controller) => {
                    pullCount++;
                    controller.enqueue({ data: "x" });
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 1000 });
            const reader = sse[TO_HTTP_RESPONSE]().body.readable.getReader();

            await delay(50);

            assert.ok(
                pullCount <= 5,
                `source was pulled ${pullCount} times without a reading consumer`,
            );

            await reader.cancel();
        });

        it("propagates cancel to the source stream", async () => {
            const { promise: cancellation, resolve: cancelled } = Promise.withResolvers<void>();

            const stream = new ReadableStream<SseEvent>({
                cancel: () => {
                    cancelled();
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const response = sse[TO_HTTP_RESPONSE]();

            await response.body.readable.getReader().cancel();
            await withTimeout(cancellation, 500, "source was not cancelled");
        });

        it("ignores cancel errors from the source stream", async () => {
            const stream = new ReadableStream<SseEvent>({
                cancel: () => {
                    throw new Error("cancel rejected");
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            await assert.doesNotReject(() => reader.cancel());
        });

        it("uses default keep-alive options", async () => {
            const { stream, close } = createControllableStream();

            const sse = new Sse(stream).keepAlive();
            const response = sse[TO_HTTP_RESPONSE]();
            assert.equal(response.status.code, 200);

            close();
            await consumers.text(response.body.readable);
        });

        it("propagates stream errors with keep-alive enabled", async () => {
            const stream = new ReadableStream<SseEvent>({
                start: (controller) => {
                    controller.error(new Error("keep-alive stream failed"));
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 50 });

            await assert.rejects(() => collectStream(sse), {
                message: "keep-alive stream failed",
            });
        });
    });
});
