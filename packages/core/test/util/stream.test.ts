import assert from "node:assert/strict";
import { Transform } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { applyNodeJsTransform } from "../../src/util/index.js";

describe("util:stream", () => {
    describe("applyNodeJsTransform", () => {
        it("transforms Uint8Array chunks from a ReadableStream", async () => {
            const inputText = "hello world";
            const inputStream = new ReadableStream<Uint8Array>({
                start: (controller) => {
                    controller.enqueue(new TextEncoder().encode(inputText));
                    controller.close();
                },
            });

            const upperCaseTransform = new Transform({
                transform(chunk: Buffer, _encoding, callback) {
                    callback(null, Buffer.from(chunk.toString().toUpperCase()));
                },
            });

            const transformedStream = applyNodeJsTransform(inputStream, upperCaseTransform);

            const result = await consumers.text(transformedStream);
            assert.equal(result, "HELLO WORLD");
        });

        it("propagates errors from the transform", async () => {
            const inputStream = new ReadableStream<Uint8Array>({
                start: (controller) => {
                    controller.enqueue(new TextEncoder().encode("data"));
                    controller.close();
                },
            });

            const errorTransform = new Transform({
                transform(_chunk: Buffer, _encoding, callback) {
                    callback(new Error("transform failed"));
                },
            });

            const transformedStream = applyNodeJsTransform(inputStream, errorTransform);

            await assert.rejects(() => consumers.text(transformedStream), /transform failed/);
        });

        it("can be cancelled without hanging", async () => {
            let pulled = false;

            const inputStream = new ReadableStream<Uint8Array>({
                pull: (controller) => {
                    controller.enqueue(new TextEncoder().encode("data"));

                    if (pulled) {
                        controller.close();
                    }

                    pulled = true;
                },
            });

            const transform = new Transform({
                transform(chunk: Buffer, _encoding, callback) {
                    callback(null, chunk);
                },
            });

            const stream = applyNodeJsTransform(inputStream, transform);
            const reader = stream.getReader();
            await reader.read();
            await reader.cancel();
        });
    });
});
