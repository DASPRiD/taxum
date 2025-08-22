import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import type { ServerResponse } from "node:http";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { callNodeRequestHandler } from "node-mock-http";
import { Body } from "../../src/http/body.js";
import {
    ExtensionKey,
    Extensions,
    HeaderMap,
    HttpResponse,
    HttpResponseBuilder,
    StatusCode,
} from "../../src/http/index.js";

describe("http:response", () => {
    describe("HttpResponse", () => {
        it("constructs with given parameters", () => {
            const status = StatusCode.OK;
            const headers = new HeaderMap();
            const body = Body.from("test");
            const res = new HttpResponse(status, headers, body);
            assert.equal(res.status, status);
            assert.equal(res.headers, headers);
            assert.equal(res.body, body);
            assert(res.extensions);
        });

        it("defaults extensions if not provided", () => {
            const res = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
            assert(res.extensions.isEmpty());
        });

        describe("from()", () => {
            it("accepts a single HttpResponseLikePart", () => {
                const res = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const result = HttpResponse.from(res);
                assert.equal(result.status, res.status);
                assert.deepEqual(result.headers.getAll("x-test"), []);
            });

            it("accepts a tuple with a single HttpResponseLikePart", () => {
                const res = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const result = HttpResponse.from([res]);
                assert.equal(result.status, res.status);
                assert.deepEqual(result.headers.getAll("x-test"), []);
            });

            it("accepts a tuple with ToHttpResponsePartsLike and HttpResponseLikePart", () => {
                const res = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const result = HttpResponse.from([[["x-test", "foo"]], res]);
                assert.equal(result.status, res.status);
                assert.deepEqual(result.headers.getAll("x-test"), ["foo"]);
            });

            it("applies first element last when it is a StatusCode", () => {
                const base = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const tuple: [StatusCode, HttpResponse] = [StatusCode.NOT_FOUND, base];
                const result = HttpResponse.from(tuple);

                assert.equal(result.status, StatusCode.NOT_FOUND);
            });

            it("applies first element last when it is a number", () => {
                const base = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const tuple: [number, HttpResponse] = [404, base];
                const result = HttpResponse.from(tuple);
                assert.equal(result.status.code, 404);
            });

            it("applies first element last when it is an HttpResponse", () => {
                const base = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const tuple: [HttpResponse, HttpResponse] = [base, base];
                const result = HttpResponse.from(tuple);
                assert.equal(result.status, base.status);
            });

            it("applies middle elements from left to right", () => {
                const headers1 = new HeaderMap();
                headers1.append("a", "b");

                const headers2 = new HeaderMap();
                headers2.append("c", "d");

                const base = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                const tuple: [StatusCode, HeaderMap, HeaderMap, HttpResponse] = [
                    StatusCode.ACCEPTED,
                    headers1,
                    headers2,
                    base,
                ];

                const result = HttpResponse.from(tuple);

                assert.equal(result.headers.get("a"), "b");
                assert.equal(result.headers.get("c"), "d");
                assert.equal(result.status, StatusCode.ACCEPTED);
            });

            it("applies first HttpResponse last, overriding headers and extensions", () => {
                const key = new ExtensionKey<number>("foo");

                const templateHeaders = new HeaderMap();
                templateHeaders.append("a", "b");

                const templateExtensions = new Extensions();
                templateExtensions.insert(key, 123);

                const templateRes = new HttpResponse(
                    StatusCode.OK,
                    templateHeaders,
                    Body.from(""),
                    templateExtensions,
                );

                const overrideHeaders = new HeaderMap();
                overrideHeaders.append("c", "d");

                const baseHeaders = new HeaderMap();
                baseHeaders.append("c", "e");

                const baseExtensions = new Extensions();
                baseExtensions.insert(key, 345);

                const baseRes = new HttpResponse(
                    StatusCode.ACCEPTED,
                    baseHeaders,
                    Body.from("x"),
                    baseExtensions,
                );

                const res = HttpResponse.from([templateRes, overrideHeaders, baseRes]);
                assert.equal(res.extensions.get(key), 123);
                assert.equal(res.headers.get("a"), "b");
                assert.equal(res.headers.get("c"), "d");
                assert.equal(res.status, StatusCode.OK);
            });
        });

        describe("write()", () => {
            it("writes status, headers and pipes body to ServerResponse", async () => {
                const status = StatusCode.OK;
                const headers = new HeaderMap();
                headers.append("content-type", "text/plain");
                const body = Body.from("hello");
                const res = new HttpResponse(status, headers, body);

                const response = await callNodeRequestHandler(async (_, serverResponse) => {
                    await res.write(serverResponse as unknown as ServerResponse);
                }, {});

                assert.equal(response.headers["content-type"], "text/plain");
                assert.equal(response.status, 200);
                assert.deepEqual(response.body, Buffer.from([104, 101, 108, 108, 111]));
            });
        });
    });

    describe("HttpResponseBuilder", () => {
        it("defaults status to OK", () => {
            const builder = new HttpResponseBuilder();
            const res = builder.body("");
            assert.equal(res.status, StatusCode.OK);
        });

        it("status() sets status from StatusCode instance", () => {
            const builder = new HttpResponseBuilder();
            builder.status(StatusCode.NOT_FOUND);
            const res = builder.body("");
            assert.equal(res.status, StatusCode.NOT_FOUND);
        });

        it("status() sets status from number", () => {
            const builder = new HttpResponseBuilder();
            builder.status(404);
            const res = builder.body("");
            assert.equal(res.status.code, 404);
        });

        it("headers() extends headers", () => {
            const builder = new HttpResponseBuilder();
            const headers = new HeaderMap();
            headers.append("x", "y");
            builder.headers(headers);
            const res = builder.body("");
            assert.equal(res.headers.get("x"), "y");
        });

        it("header() appends header", () => {
            const builder = new HttpResponseBuilder();
            builder.header("x", "y");
            builder.header("x", "z");
            const res = builder.body("");
            const vals = res.headers.getAll("x");
            assert.deepEqual(vals, ["y", "z"]);
        });

        it("extensions() sets extensions", () => {
            const key = new ExtensionKey("foo");
            const ext = new Extensions();
            ext.insert(key, 123);

            const builder = new HttpResponseBuilder();
            builder.extensions(ext);
            const res = builder.body(null);
            assert.equal(res.extensions, ext);
        });

        it("extension() inserts a single extension key-value", () => {
            const builder = new HttpResponseBuilder();
            const key = new ExtensionKey("foo");
            builder.extension(key, "value");
            const res = builder.body(null);
            assert.equal(res.extensions.get(key), "value");
        });

        it("body() creates HttpResponse with given body", async () => {
            const builder = new HttpResponseBuilder();
            const res = builder.body("hello");
            assert(await consumers.text(res.body.readable), "hello");
        });
    });
});
