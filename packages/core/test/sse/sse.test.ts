import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { TO_HTTP_RESPONSE } from "../../src/http/index.js";
import { Sse, type SseEvent } from "../../src/sse/index.js";

const collectStream = async (sse: Sse): Promise<string> => {
    const response = sse[TO_HTTP_RESPONSE]();
    return consumers.text(response.body.readable);
};

type StreamControl = {
    stream: ReadableStream<SseEvent>;
    enqueue: (event: SseEvent) => void;
    close: () => void;
};

const createControllableStream = (): StreamControl => {
    let enqueue: ((event: SseEvent) => void) | undefined;
    let close: (() => void) | undefined;

    const stream = new ReadableStream<SseEvent>({
        start(controller) {
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
                start(controller) {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.headers.get("content-type")?.value, "text/event-stream");
        });

        it("sets cache-control to no-cache", () => {
            const stream = new ReadableStream<SseEvent>({
                start(controller) {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.headers.get("cache-control")?.value, "no-cache");
        });

        it("sets connection to keep-alive", () => {
            const stream = new ReadableStream<SseEvent>({
                start(controller) {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.headers.get("connection")?.value, "keep-alive");
        });

        it("returns 200 OK status", () => {
            const stream = new ReadableStream<SseEvent>({
                start(controller) {
                    controller.close();
                },
            });
            const response = new Sse(stream)[TO_HTTP_RESPONSE]();
            assert.equal(response.status.code, 200);
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
                start(controller) {
                    controller.enqueue({ data: "hello" });
                    controller.close();
                },
            });

            const result = await collectStream(new Sse(stream));
            assert.equal(result, "data: hello\n\n");
        });

        it("transforms multiple events to bytes", async () => {
            const stream = new ReadableStream<SseEvent>({
                start(controller) {
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
                start(controller) {
                    controller.close();
                },
            });

            const result = await collectStream(new Sse(stream));
            assert.equal(result, "");
        });

        it("propagates stream errors", async () => {
            const stream = new ReadableStream<SseEvent>({
                start(controller) {
                    controller.error(new Error("stream failed"));
                },
            });

            await assert.rejects(() => collectStream(new Sse(stream)), {
                message: "stream failed",
            });
        });
    });

    describe("keep-alive", () => {
        it("sends keep-alive comment when stream is idle", async () => {
            const { stream, enqueue, close } = createControllableStream();

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            // Wait for keep-alive to fire
            await new Promise((resolve) => setTimeout(resolve, 80));

            const { value: keepAliveChunk } = await reader.read();
            const decoded = new TextDecoder().decode(keepAliveChunk);
            assert.equal(decoded, ": \n\n");

            // Send a real event and close
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

            // Wait for keep-alive to fire
            await new Promise((resolve) => setTimeout(resolve, 80));

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

            // Send an event before keep-alive fires
            await new Promise((resolve) => setTimeout(resolve, 30));
            enqueue({ data: "early" });

            const { value: eventChunk } = await reader.read();
            assert.equal(new TextDecoder().decode(eventChunk), "data: early\n\n");

            // Wait less than the interval — no keep-alive should fire yet
            await new Promise((resolve) => setTimeout(resolve, 50));
            close();

            // Should get end-of-stream, not a keep-alive
            const { done } = await reader.read();
            assert.equal(done, true);
        });

        it("cleans up timer on cancel", async () => {
            const stream = new ReadableStream<SseEvent>({
                start() {
                    // Never closes — simulates a long-lived stream
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            // Cancel immediately
            await reader.cancel();

            // If the timer wasn't cleaned up, the test would hang or leak
            assert.ok(true);
        });

        it("ignores cancel errors from the source stream", async () => {
            const stream = new ReadableStream<SseEvent>({
                start() {
                    // Never closes
                },
                cancel() {
                    throw new Error("cancel rejected");
                },
            });

            const sse = new Sse(stream).keepAlive({ interval: 50 });
            const response = sse[TO_HTTP_RESPONSE]();
            const reader = response.body.readable.getReader();

            // Should not throw despite source cancel rejecting
            await reader.cancel();
            assert.ok(true);
        });

        it("uses default keep-alive options", async () => {
            const { stream, close } = createControllableStream();

            const sse = new Sse(stream).keepAlive();

            // Verify it doesn't throw and creates a valid response
            const response = sse[TO_HTTP_RESPONSE]();
            assert.equal(response.status.code, 200);

            close();
            // Drain the stream
            await consumers.text(response.body.readable);
        });

        it("propagates stream errors with keep-alive enabled", async () => {
            const stream = new ReadableStream<SseEvent>({
                start(controller) {
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
