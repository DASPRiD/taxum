import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpResponse } from "@taxum/core/http";
import { m, Router } from "@taxum/core/routing";
import { Sse, type SseEvent } from "@taxum/core/sse";
import { TestResponse, testClient } from "../src/index.js";

const encoder = new TextEncoder();

const sseResponse = (wire: string, chunkSize = Number.POSITIVE_INFINITY): TestResponse => {
    const bytes = encoder.encode(wire);
    const chunks: Uint8Array[] = [];

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        chunks.push(bytes.slice(offset, offset + chunkSize));
    }

    return TestResponse.from(
        HttpResponse.builder()
            .header("content-type", "text/event-stream")
            .body(ReadableStream.from(chunks)),
    );
};

const collect = async (
    res: TestResponse,
    options?: { comments?: boolean },
): Promise<SseEvent[]> => {
    const events: SseEvent[] = [];

    for await (const event of res.sseEvents(options)) {
        events.push(event);
    }

    return events;
};

describe("sse", () => {
    it("parses events in core's wire format", async () => {
        const wire = "event: update\ndata: first\nid: 1\nretry: 5000\n\ndata: second\n\nid: 3\n\n";

        assert.deepEqual(await collect(sseResponse(wire)), [
            { event: "update", data: "first", id: "1", retry: 5000 },
            { data: "second" },
            { id: "3" },
        ]);
    });

    it("reassembles multi-line data", async () => {
        const events = await collect(sseResponse("data: line1\ndata: line2\ndata: line3\n\n"));

        assert.deepEqual(events, [{ data: "line1\nline2\nline3" }]);
    });

    it("strips exactly one leading space from field values", async () => {
        const events = await collect(sseResponse("data:no-space\n\ndata:  padded\n\n"));

        assert.deepEqual(events, [{ data: "no-space" }, { data: " padded" }]);
    });

    it("skips comments by default, including keep-alive blocks", async () => {
        const wire = ": keep-alive\n\ndata: real\n: inline comment\n\n: another ping\n\n";

        const events = await collect(sseResponse(wire));

        assert.deepEqual(events, [{ data: "real" }]);
    });

    it("yields comments when opted in", async () => {
        const wire = ": keep-alive\n\ndata: real\n: inline\n\n";

        const events = await collect(sseResponse(wire), { comments: true });

        assert.deepEqual(events, [{ comment: "keep-alive" }, { comment: "inline", data: "real" }]);
    });

    it("ignores invalid retry and id fields", async () => {
        const wire = "retry: abc\ndata: x\n\nid: with\0nul\ndata: y\n\n";

        const events = await collect(sseResponse(wire));

        assert.deepEqual(events, [{ data: "x" }, { data: "y" }]);
    });

    it("ignores unknown fields and fieldless lines", async () => {
        const wire = "custom: ignored\nnocolon\ndata: kept\n\n";

        const events = await collect(sseResponse(wire));

        assert.deepEqual(events, [{ data: "kept" }]);
    });

    it("treats a lone data field with empty value as empty data", async () => {
        const events = await collect(sseResponse("data:\n\n"));

        assert.deepEqual(events, [{ data: "" }]);
    });

    it("discards an incomplete trailing block", async () => {
        const events = await collect(sseResponse("data: complete\n\ndata: incomplete\n"));

        assert.deepEqual(events, [{ data: "complete" }]);
    });

    it("handles CRLF and CR line endings", async () => {
        const events = await collect(sseResponse("data: a\r\n\r\ndata: b\r\r"));

        assert.deepEqual(events, [{ data: "a" }, { data: "b" }]);
    });

    it("parses events split across arbitrary chunk boundaries", async () => {
        const wire = "event: update\r\ndata: first\n\ndata: second\r\r";

        for (const chunkSize of [1, 2, 3, 5]) {
            const events = await collect(sseResponse(wire, chunkSize));

            assert.deepEqual(events, [{ event: "update", data: "first" }, { data: "second" }]);
        }
    });

    it("cancels the body stream when the consumer breaks", async () => {
        let cancelled = false;
        const stream = new ReadableStream<Uint8Array>({
            start: (controller) => {
                controller.enqueue(encoder.encode("data: one\n\n"));
            },
            cancel: () => {
                cancelled = true;
            },
        });
        const res = TestResponse.from(HttpResponse.builder().body(stream));

        for await (const event of res.sseEvents()) {
            assert.deepEqual(event, { data: "one" });
            break;
        }

        assert.equal(cancelled, true);
    });

    it("is mutually exclusive with the buffered readers", async () => {
        const buffered = sseResponse("data: x\n\n");
        await buffered.text();
        assert.throws(() => buffered.sseEvents(), /already been buffered/);

        const streamed = sseResponse("data: x\n\n");
        await collect(streamed);
        await assert.rejects(streamed.text(), /consumed as an SSE stream/);
        assert.throws(() => streamed.sseEvents(), /already being consumed/);
    });

    it("rejects the iteration with the original stream error", async () => {
        const failure = new Error("stream broke");
        let pulls = 0;
        const stream = new ReadableStream<Uint8Array>({
            pull: (controller) => {
                pulls++;

                if (pulls === 1) {
                    controller.enqueue(encoder.encode("data: one\n\n"));
                } else {
                    controller.error(failure);
                }
            },
        });
        const res = TestResponse.from(HttpResponse.builder().body(stream));
        const events: SseEvent[] = [];

        await assert.rejects(async () => {
            for await (const event of res.sseEvents()) {
                events.push(event);
            }
        }, failure);

        assert.deepEqual(events, [{ data: "one" }]);
    });

    it("commits the response to streaming as soon as sseEvents() is called", async () => {
        const res = sseResponse("data: x\n\n");
        void res.sseEvents();

        await assert.rejects(res.text(), /consumed as an SSE stream/);
    });

    it("propagates a break to the handler's finally like a disconnect", async () => {
        let cleanedUp = false;
        const events = async function* (): AsyncGenerator<SseEvent> {
            try {
                yield { data: "one" };
                yield { data: "two" };
            } finally {
                cleanedUp = true;
            }
        };
        const router = new Router().route(
            "/events",
            m.get(() => new Sse(events())),
        );

        const res = await testClient(router).get("/events");

        for await (const event of res.sseEvents()) {
            assert.deepEqual(event, { data: "one" });
            break;
        }

        for (let i = 0; i < 50 && !cleanedUp; i++) {
            await new Promise((resolve) => {
                setImmediate(resolve);
            });
        }

        assert.equal(cleanedUp, true);
    });

    it("consumes a real Sse handler response end to end", async () => {
        const events = async function* (): AsyncGenerator<SseEvent> {
            yield { event: "created", data: JSON.stringify({ id: 1 }), id: "1" };
            yield { data: "plain" };
        };
        const router = new Router().route(
            "/events",
            m.get(() => new Sse(events())),
        );

        const res = await testClient(router).get("/events");

        assert.equal(res.headers.get("content-type"), "text/event-stream");
        assert.deepEqual(await collect(res), [
            { event: "created", data: '{"id":1}', id: "1" },
            { data: "plain" },
        ]);
    });
});
