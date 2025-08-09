import assert from "node:assert/strict";
import { Readable, Transform } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { LazyWrappedReadable } from "../../src/http/index.js";

describe("http:wrapStream", () => {
    it("pipes data through transform", async () => {
        const source = Readable.from(["hello", " ", "world"]);

        const transform = new Transform({
            transform(chunk, _encoding, callback) {
                callback(null, chunk.toString().toUpperCase());
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);
        const result = await consumers.text(wrapped);

        assert.equal(result, "HELLO WORLD");
    });

    it("emits end event correctly", async () => {
        const source = Readable.from(["foo"]);
        const transform = new Transform({
            transform(chunk, _encoding, callback) {
                callback(null, chunk);
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);
        let endCalled = false;

        wrapped.on("end", () => {
            endCalled = true;
        });

        await consumers.text(wrapped);
        assert(endCalled);
    });

    it("forwards error from source and destroys streams", async () => {
        const source = new Readable({
            read() {
                setImmediate(() => this.destroy(new Error("source error")));
            },
        });

        const transform = new Transform({
            transform(chunk, _encoding, callback) {
                callback(null, chunk);
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);

        try {
            await consumers.text(wrapped);
            assert.fail("Expected error was not thrown");
        } catch (err) {
            assert(err instanceof Error);
            assert.strictEqual(err.message, "source error");
            // The wrapped stream should be destroyed
            assert(wrapped.destroyed);
        }
    });

    it("forwards error from transform and destroys streams", async () => {
        const source = Readable.from(["hello"]);

        const transform = new Transform({
            transform(_chunk, _encoding, callback) {
                callback(new Error("transform error"));
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);

        try {
            await consumers.text(wrapped);
            assert.fail("Expected transform error was not thrown");
        } catch (err) {
            assert(err instanceof Error);
            assert.strictEqual(err.message, "transform error");
            assert(wrapped.destroyed);
        }
    });

    it("destroying wrapped destroys source and transform streams", async () => {
        let sourceDestroyed = false;
        let transformDestroyed = false;

        const source = new Readable({
            read() {
                // noop
            },
            destroy(err, cb) {
                sourceDestroyed = true;
                cb(err);
            },
        });

        const transform = new Transform({
            transform(chunk, _encoding, callback) {
                callback(null, chunk);
            },
            destroy(err, cb) {
                transformDestroyed = true;
                cb(err);
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);

        await new Promise<void>((resolve, reject) => {
            wrapped.on("error", (error) => {
                assert(error.message === "test destroy");
            });

            wrapped.destroy(new Error("test destroy"));

            wrapped.once("close", () => {
                try {
                    assert(sourceDestroyed, "Source was not destroyed");
                    assert(transformDestroyed, "Transform was not destroyed");
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });

    it("starts reading from source lazily on first read", async () => {
        let sourceReadCalled = false;

        const source = new Readable({
            read() {
                sourceReadCalled = true;
                this.push("data");
                this.push(null);
            },
        });

        const transform = new Transform({
            transform(chunk, _encoding, callback) {
                callback(null, chunk.toString().toUpperCase());
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);

        // Initially, source.read() should not have been called
        assert.strictEqual(sourceReadCalled, false);

        // When we consume wrapped, source.read() is triggered lazily
        const output = await consumers.text(wrapped);

        assert.strictEqual(sourceReadCalled, true);
        assert.strictEqual(output, "DATA");
    });

    it("handles backpressure correctly", async () => {
        // This is a bit tricky to test precisely without a custom consumer,
        // but we at least verify that pausing and resuming works.

        let readCalls = 0;

        const source = new Readable({
            read() {
                readCalls++;
                // Push data slowly
                if (readCalls <= 3) {
                    this.push(`chunk${readCalls}`);
                } else {
                    this.push(null);
                }
            },
        });

        const transform = new Transform({
            transform(chunk, _encoding, callback) {
                setTimeout(() => {
                    callback(null, chunk);
                }, 10);
            },
        });

        const wrapped = new LazyWrappedReadable(source, transform);

        const collected: string[] = [];

        wrapped.on("data", (chunk) => {
            collected.push(chunk.toString());
            // Artificially pause/resume
            wrapped.pause();
            setTimeout(() => wrapped.resume(), 20);
        });

        await new Promise<void>((resolve, reject) => {
            wrapped.on("end", () => resolve());
            wrapped.on("error", reject);
        });

        assert.deepEqual(collected, ["chunk1", "chunk2", "chunk3"]);
    });
});
