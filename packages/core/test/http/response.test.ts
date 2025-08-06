import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callNodeRequestHandler } from "node-mock-http";
import { Body } from "../../src/http/body.js";
import {
    ExtensionKey,
    Extensions,
    HeaderMap,
    HttpResponse,
    HttpResponseBuilder,
    isToHttpResponse,
    StatusCode,
} from "../../src/http/index.js";

describe("http:response", () => {
    describe("HttpResponse", () => {
        it("constructs with given parameters", () => {
            const status = StatusCode.OK;
            const headers = new HeaderMap();
            const body = Body.from("test");
            const resp = new HttpResponse(status, headers, body);
            assert.equal(resp.status, status);
            assert.equal(resp.headers, headers);
            assert.equal(resp.body, body);
            assert(resp.extensions);
        });

        it("defaults extensions if not provided", () => {
            const resp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
            assert(resp.extensions.isEmpty());
        });

        describe("from()", () => {
            it("accepts an HttpResponse instance", () => {
                const resp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const result = HttpResponse.from(resp);
                assert.equal(result.status, resp.status);
                assert.deepEqual(result.headers.getAll("x-test"), []);
            });

            it("accepts [StatusCode, HttpResponseLikePart]", () => {
                const baseResp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const tuple: [StatusCode, HttpResponse] = [StatusCode.NOT_FOUND, baseResp];
                const result = HttpResponse.from(tuple);
                assert.equal(result.status, StatusCode.NOT_FOUND);
            });

            it("accepts [number, HttpResponseLikePart]", () => {
                const baseResp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const tuple: [number, HttpResponse] = [404, baseResp];
                const result = HttpResponse.from(tuple);
                assert.equal(result.status.code, 404);
            });

            it("accepts [HttpResponse, HttpResponseLikePart]", () => {
                const baseResp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const tuple: [HttpResponse, HttpResponse] = [baseResp, baseResp];
                const result = HttpResponse.from(tuple);
                assert.equal(result.status, baseResp.status);
            });

            it("accepts [StatusCode, HeaderMap, HttpResponseLikePart]", () => {
                const headers = new HeaderMap();
                headers.append("x", "y");
                const baseResp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const tuple: [StatusCode, HeaderMap, HttpResponse] = [
                    StatusCode.OK,
                    headers,
                    baseResp,
                ];
                const result = HttpResponse.from(tuple);
                assert.equal(result.headers.get("x"), "y");
            });

            it("accepts [number, HeaderMap, HttpResponseLikePart]", () => {
                const headers = new HeaderMap();
                headers.append("x", "y");
                const baseResp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const tuple: [number, HeaderMap, HttpResponse] = [200, headers, baseResp];
                const result = HttpResponse.from(tuple);
                assert.equal(result.headers.get("x"), "y");
            });

            it("accepts [HttpResponse, HeaderMap, HttpResponseLikePart]", () => {
                const headers = new HeaderMap();
                headers.append("x", "y");
                const baseResp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const tuple: [HttpResponse, HeaderMap, HttpResponse] = [
                    baseResp,
                    headers,
                    baseResp,
                ];
                const result = HttpResponse.from(tuple);
                assert.equal(result.headers.get("x"), "y");
            });

            it("merges headers and extensions correctly", () => {
                const key = new ExtensionKey<number>("foo");

                const templateHeaders = new HeaderMap();
                templateHeaders.append("a", "b");

                const templateExtensions = new Extensions();
                templateExtensions.insert(key, 123);

                const templateRes = new HttpResponse(
                    StatusCode.OK,
                    templateHeaders,
                    Body.from("x"),
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

        describe("toOwned()", () => {
            it("creates a new instance with same values", () => {
                const resp = new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("x"));
                const owned = resp.toOwned();
                assert(owned !== resp);
                assert.equal(owned.status, resp.status);
                assert.equal(owned.body, resp.body);
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
                    await res.write(serverResponse);
                }, {});

                assert.equal(response.headers["content-type"], "text/plain");
                assert.equal(response.status, 200);
                assert.equal(response.body, "hello");
            });
        });
    });

    describe("HttpResponseBuilder", () => {
        it("defaults status to OK", () => {
            const builder = new HttpResponseBuilder();
            const resp = builder.body("");
            assert.equal(resp.status, StatusCode.OK);
        });

        it("status() sets status from StatusCode instance", () => {
            const builder = new HttpResponseBuilder();
            builder.status(StatusCode.NOT_FOUND);
            const resp = builder.body("");
            assert.equal(resp.status, StatusCode.NOT_FOUND);
        });

        it("status() sets status from number", () => {
            const builder = new HttpResponseBuilder();
            builder.status(404);
            const resp = builder.body("");
            assert.equal(resp.status.code, 404);
        });

        it("headers() extends headers", () => {
            const builder = new HttpResponseBuilder();
            const headers = new HeaderMap();
            headers.append("x", "y");
            builder.headers(headers);
            const resp = builder.body("");
            assert.equal(resp.headers.get("x"), "y");
        });

        it("header() appends header", () => {
            const builder = new HttpResponseBuilder();
            builder.header("x", "y");
            builder.header("x", "z");
            const resp = builder.body("");
            const vals = resp.headers.getAll("x");
            assert.deepEqual(vals, ["y", "z"]);
        });

        it("body() creates HttpResponse with given body", () => {
            const builder = new HttpResponseBuilder();
            const resp = builder.body("hello");
            assert(resp.body);
        });
    });

    describe("Helpers", () => {
        it("isToHttpResponse detects correct objects", () => {
            const obj = {
                toHttpResponse() {
                    return new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from(""));
                },
            };
            assert(isToHttpResponse(obj));
            assert(!isToHttpResponse({}));
            assert(!isToHttpResponse(null));
        });
    });
});
