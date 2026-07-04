import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeSseEvent } from "../../src/sse/event.js";

const decoder = new TextDecoder();
const serialize = (event: Parameters<typeof serializeSseEvent>[0]): string =>
    decoder.decode(serializeSseEvent(event));

describe("sse:serializeSseEvent", () => {
    describe("data", () => {
        it("serializes a simple data field", () => {
            assert.equal(serialize({ data: "hello" }), "data: hello\n\n");
        });

        it("splits multi-line data with LF into multiple data fields", () => {
            assert.equal(
                serialize({ data: "line1\nline2\nline3" }),
                "data: line1\ndata: line2\ndata: line3\n\n",
            );
        });

        it("splits multi-line data with CR into multiple data fields", () => {
            assert.equal(
                serialize({ data: "line1\rline2\rline3" }),
                "data: line1\ndata: line2\ndata: line3\n\n",
            );
        });

        it("splits multi-line data with CRLF into multiple data fields", () => {
            assert.equal(
                serialize({ data: "line1\r\nline2\r\nline3" }),
                "data: line1\ndata: line2\ndata: line3\n\n",
            );
        });

        it("handles empty data", () => {
            assert.equal(serialize({ data: "" }), "data: \n\n");
        });
    });

    describe("event", () => {
        it("serializes the event type", () => {
            assert.equal(
                serialize({ event: "update", data: "test" }),
                "event: update\ndata: test\n\n",
            );
        });

        it("throws when event type contains a newline", () => {
            assert.throws(() => serializeSseEvent({ event: "a\nb" }), {
                message: "Event type must not contain newlines or carriage returns",
            });
        });

        it("throws when event type contains a carriage return", () => {
            assert.throws(() => serializeSseEvent({ event: "a\rb" }), {
                message: "Event type must not contain newlines or carriage returns",
            });
        });
    });

    describe("id", () => {
        it("serializes the event ID", () => {
            assert.equal(serialize({ id: "42", data: "test" }), "data: test\nid: 42\n\n");
        });

        it("throws when ID contains a newline", () => {
            assert.throws(() => serializeSseEvent({ id: "a\nb" }), {
                message: "Event ID must not contain newlines, carriage returns, or null characters",
            });
        });

        it("throws when ID contains a carriage return", () => {
            assert.throws(() => serializeSseEvent({ id: "a\rb" }), {
                message: "Event ID must not contain newlines, carriage returns, or null characters",
            });
        });

        it("throws when ID contains a null character", () => {
            assert.throws(() => serializeSseEvent({ id: "a\0b" }), {
                message: "Event ID must not contain newlines, carriage returns, or null characters",
            });
        });
    });

    describe("retry", () => {
        it("serializes the retry field", () => {
            assert.equal(serialize({ retry: 5000, data: "test" }), "data: test\nretry: 5000\n\n");
        });

        it("allows zero as retry value", () => {
            assert.equal(serialize({ retry: 0 }), "retry: 0\n\n");
        });

        it("throws for negative values", () => {
            assert.throws(() => serializeSseEvent({ retry: -1 }), {
                message: "Retry must be a non-negative integer",
            });
        });

        it("throws for non-integer values", () => {
            assert.throws(() => serializeSseEvent({ retry: 1.5 }), {
                message: "Retry must be a non-negative integer",
            });
        });
    });

    describe("comment", () => {
        it("serializes a comment line", () => {
            assert.equal(serialize({ comment: "ping" }), ": ping\n\n");
        });

        it("handles empty comment", () => {
            assert.equal(serialize({ comment: "" }), ": \n\n");
        });

        it("throws when comment contains a newline", () => {
            assert.throws(() => serializeSseEvent({ comment: "a\nb" }), {
                message: "Comment must not contain newlines or carriage returns",
            });
        });

        it("throws when comment contains a carriage return", () => {
            assert.throws(() => serializeSseEvent({ comment: "a\rb" }), {
                message: "Comment must not contain newlines or carriage returns",
            });
        });
    });

    describe("serialization order", () => {
        it("serializes fields in spec order: comment, event, data, id, retry", () => {
            assert.equal(
                serialize({ retry: 3000, id: "1", data: "hello", event: "msg", comment: "note" }),
                ": note\nevent: msg\ndata: hello\nid: 1\nretry: 3000\n\n",
            );
        });

        it("serializes an empty event as just a blank line", () => {
            assert.equal(serialize({}), "\n");
        });
    });
});
