import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { Body, isBodyLike, SizeHint, StatusCode } from "../../src/http/index.js";

describe("http:body", () => {
    describe("Body", () => {
        it("defaults to unbounded size", () => {
            const body = new Body(Readable.from([]));
            assert.deepEqual(body.sizeHint, SizeHint.unbounded());
        });

        describe("from()", () => {
            it("creates a Body from null", async () => {
                const body = Body.from(null);
                assert.deepEqual(body.sizeHint, SizeHint.exact(0));
            });

            it("returns the same Body if already a Body", () => {
                const orig = Body.from("hello");
                const result = Body.from(orig);
                assert.equal(result, orig);
            });

            it("wraps a Readable stream", () => {
                const stream = Readable.from(["test"]);
                const body = Body.from(stream);

                assert.deepEqual(body.sizeHint, SizeHint.unbounded());
                assert.equal(body.contentTypeHint, "application/octet-stream");
            });

            it("wraps a string", async () => {
                const str = "hello world";
                const body = Body.from(str);
                assert.equal(body.contentTypeHint, "text/plain; charset=utf-8");
                assert.deepEqual(body.sizeHint, SizeHint.exact(Buffer.byteLength(str)));

                const content = await consumers.text(body.read());
                assert.equal(content.toString(), str);
            });

            it("wraps a Buffer", async () => {
                const buf = Buffer.from("abc");
                const body = Body.from(buf);
                assert.deepEqual(body.sizeHint, SizeHint.exact(buf.length));
                assert.equal(body.contentTypeHint, "application/octet-stream");

                const content = await consumers.text(body.read());
                assert.equal(content.toString(), "abc");
            });

            it("wraps a Uint8Array", async () => {
                const arr = new Uint8Array([65, 66, 67]);
                const body = Body.from(arr);
                assert.deepEqual(body.sizeHint, SizeHint.exact(arr.length));
                assert.equal(body.contentTypeHint, "application/octet-stream");

                const content = await consumers.buffer(body.read());
                assert.equal(content.toString(), "ABC");
            });

            it("wraps a ReadableStream using fromWeb", () => {
                const rs = new ReadableStream({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode("xyz"));
                        controller.close();
                    },
                });

                const body = Body.from(rs);
                assert.deepEqual(body.sizeHint, SizeHint.unbounded());
                assert.equal(body.contentTypeHint, "application/octet-stream");
            });
        });

        describe("read()", () => {
            it("returns inner readable stream", () => {
                const body = Body.from("test");
                body.read();
            });

            it("throws if body has been consumed", async () => {
                const body = Body.from("once");
                body.read();

                assert.throws(() => {
                    body.read();
                }, /Body has already been consumed/);
            });
        });

        describe("toHttpResponse()", () => {
            it("creates HttpResponse with 200 OK and content-type", () => {
                const body = Body.from("content");
                const res = body.toHttpResponse();

                assert.equal(res.status, StatusCode.OK);
                assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
            });

            it("omits content-type header if not hinted", () => {
                const stream = Readable.from(["x"]);
                const body = new Body(stream, SizeHint.unbounded());
                const res = body.toHttpResponse();

                assert(!res.headers.containsKey("content-type"));
            });
        });
    });

    describe("isBodyLike", () => {
        it("returns true for Body", () => {
            assert.equal(isBodyLike(Body.from("x")), true);
        });

        it("returns true for string", () => {
            assert.equal(isBodyLike("hello"), true);
        });

        it("returns true for Buffer", () => {
            assert.equal(isBodyLike(Buffer.from("abc")), true);
        });

        it("returns true for Uint8Array", () => {
            assert.equal(isBodyLike(new Uint8Array()), true);
        });

        it("returns true for Readable", () => {
            assert.equal(isBodyLike(Readable.from([])), true);
        });

        it("returns true for ReadableStream", () => {
            const rs = new ReadableStream();
            assert.equal(isBodyLike(rs), true);
        });

        it("returns true for null", () => {
            assert.equal(isBodyLike(null), true);
        });

        it("returns false for invalid types", () => {
            assert.equal(isBodyLike(123), false);
            assert.equal(isBodyLike(undefined), false);
            assert.equal(isBodyLike({}), false);
            assert.equal(
                isBodyLike(() => {
                    // Empty function
                }),
                false,
            );
        });
    });
});
