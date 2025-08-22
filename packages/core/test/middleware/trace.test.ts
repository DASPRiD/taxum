import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import {
    DefaultOnFailure,
    DefaultOnRequest,
    DefaultOnResponse,
    ServerErrorAsFailureClassifier,
    TraceLayer,
} from "../../src/middleware/trace.js";
import type { HttpService } from "../../src/service/index.js";

describe("middleware:trace", () => {
    const okService: HttpService = {
        invoke: async () => HttpResponse.builder().status(StatusCode.OK).body("ok"),
    };

    const errorService: HttpService = {
        invoke: async () =>
            HttpResponse.builder().status(StatusCode.INTERNAL_SERVER_ERROR).body("error"),
    };

    it("calls onRequest and onResponse for successful request", async () => {
        let onRequestCalled = false;
        let onResponseCalled = false;

        const layer = new TraceLayer()
            .onRequest({
                onRequest: () => {
                    onRequestCalled = true;
                },
            })
            .onResponse({
                onResponse: (res, latency) => {
                    onResponseCalled = true;
                    assert.equal(res.status.code, StatusCode.OK.code);
                    assert(latency >= 0);
                },
            });

        const service = layer.layer({
            invoke: async () => HttpResponse.builder().status(StatusCode.OK).body("response"),
        });

        const req = HttpRequest.builder().body("body");
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.readable), "response");

        assert.ok(onRequestCalled, "onRequest was not called");
        assert.ok(onResponseCalled, "onResponse was not called");
    });

    it("calls onFailure when classifier matches a server error", async (t) => {
        t.mock.method(console, "debug", () => {
            // noop
        });

        let failureCalled = false;

        const layer = new TraceLayer().onFailure({
            onFailure: (classification, latency) => {
                failureCalled = true;
                assert.equal(classification, "Internal Server Error");
                assert(latency >= 0);
            },
        });

        const service = layer.layer(errorService);

        const req = HttpRequest.builder().body("fail");
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.INTERNAL_SERVER_ERROR.code);
        assert.ok(failureCalled, "onFailure was not called");
    });

    it("does not call onFailure for non-error responses", async (t) => {
        t.mock.method(console, "debug", () => {
            // noop
        });

        let failureCalled = false;

        const layer = new TraceLayer().onFailure({
            onFailure: () => {
                failureCalled = true;
            },
        });

        const service = layer.layer(okService);

        const req = HttpRequest.builder().body("ok");
        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.OK.code);
        assert.equal(await consumers.text(res.body.readable), "ok");
        assert.equal(failureCalled, false, "onFailure should not have been called");
    });

    it("allows custom classifier", async (t) => {
        t.mock.method(console, "debug", () => {
            // noop
        });

        const errorSpy = t.mock.method(console, "error", () => {
            // noop
        });

        const layer = new TraceLayer().classifier({
            classifyResponse: () => {
                return "yuck";
            },
        });

        const service = layer.layer(okService);

        const req = HttpRequest.builder().body("ok");
        await service.invoke(req);

        const [msg, data] = errorSpy.mock.calls[0].arguments;
        assert.match(msg, /response failed/);
        assert.equal(data.classification, "yuck");
    });

    describe("ServerErrorAsFailureClassifier", () => {
        it("returns null for non-server-error responses", () => {
            const classifier = new ServerErrorAsFailureClassifier();
            const result = classifier.classifyResponse(
                HttpResponse.builder().status(StatusCode.OK).body(null),
            );

            assert.equal(result, null);
        });

        it("returns phrase for server-error responses", () => {
            const classifier = new ServerErrorAsFailureClassifier();
            const result = classifier.classifyResponse(
                HttpResponse.builder().status(StatusCode.INTERNAL_SERVER_ERROR).body(null),
            );

            assert.equal(result, "Internal Server Error");
        });
    });

    describe("DefaultOnRequest", () => {
        it("logs at debug by default", async (t) => {
            const debugSpy = t.mock.method(console, "debug", () => {
                // noop
            });

            const onRequest = new DefaultOnRequest();
            const req = HttpRequest.builder().body("req");

            onRequest.onRequest(req);

            assert.equal(debugSpy.mock.calls.length, 1);
            assert.match(debugSpy.mock.calls[0].arguments[0], /started processing request/);
        });
    });

    describe("DefaultOnResponse", () => {
        it("logs status and latency", async (t) => {
            const debugSpy = t.mock.method(console, "debug", () => {
                // noop
            });

            const onResponse = new DefaultOnResponse(); // default = "debug"

            onResponse.onResponse(HttpResponse.builder().status(StatusCode.OK).body(null), 42);

            assert.equal(debugSpy.mock.calls.length, 1);
            const [msg, data] = debugSpy.mock.calls[0].arguments;
            assert.match(msg, /finished processing request/);
            assert.equal(data.status.code, StatusCode.OK.code);
            assert.equal(data.latency, 42);
            assert.equal(data.headers, undefined);
        });

        it("logs headers when includeHeaders = true", async (t) => {
            const debugSpy = t.mock.method(console, "debug", () => {
                // noop
            });

            const onResponse = new DefaultOnResponse("debug", true);

            onResponse.onResponse(HttpResponse.builder().status(StatusCode.OK).body(null), 99);

            const [, data] = debugSpy.mock.calls[0].arguments;
            assert.ok(Array.isArray(data.headers));
        });
    });

    describe("DefaultOnResponse", () => {
        it("logs classification at error level by default", async (t) => {
            const errorSpy = t.mock.method(console, "error", () => {
                // noop
            });

            const onFailure = new DefaultOnFailure();

            onFailure.onFailure("Internal Server Error", 77);

            assert.equal(errorSpy.mock.calls.length, 1);
            const [msg, data] = errorSpy.mock.calls[0].arguments;
            assert.match(msg, /response failed/);
            assert.equal(data.classification, "Internal Server Error");
            assert.equal(data.latency, 77);
        });
    });
});
