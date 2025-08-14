import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    HttpResponse,
    StatusCode,
    TO_HTTP_RESPONSE,
    type ToHttpResponse,
} from "../../src/http/index.js";
import { defaultErrorHandler } from "../../src/routing/index.js";

describe("routing:error-handler", () => {
    describe("defaultErrorHandler", () => {
        it("logs 5xx errors of unknown errors", (t) => {
            const spy = t.mock.method(console, "error", () => {
                // Suppress console.error
            });

            defaultErrorHandler(new Error("foo"));
            assert.match(spy.mock.calls[0].arguments[0], /failed to serve request/i);
        });

        it("logs 5xx errors of ToHttpResponse errors", (t) => {
            const error = new Error("foo");
            const response = HttpResponse.builder().status(StatusCode.GATEWAY_TIMEOUT).body(null);
            (error as unknown as ToHttpResponse)[TO_HTTP_RESPONSE] = () => response;

            const spy = t.mock.method(console, "error", () => {
                // Suppress console.error
            });

            const returnedResponse = defaultErrorHandler(error);
            assert.equal(returnedResponse, response);
            assert.match(spy.mock.calls[0].arguments[0], /failed to serve request/i);
        });

        it("does not log 4xx errors", (t) => {
            const error = new Error("foo");
            const response = HttpResponse.builder().status(StatusCode.BAD_REQUEST).body(null);
            (error as unknown as ToHttpResponse)[TO_HTTP_RESPONSE] = () => response;

            const spy = t.mock.method(console, "error", () => {
                // Suppress console.error
            });

            const returnedResponse = defaultErrorHandler(error);
            assert.equal(returnedResponse, response);
            assert.equal(spy.mock.calls.length, 0);
        });
    });
});
