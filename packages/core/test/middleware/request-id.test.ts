import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import {
    PropagateRequestIdLayer,
    REQUEST_ID,
    SetRequestIdLayer,
} from "../../src/middleware/request-id.js";
import type { HttpService } from "../../src/service/index.js";

describe("middleware:request-id", () => {
    describe("SetRequestIdLayer", () => {
        it("defaults to UUID", async () => {
            const innerService: HttpService = {
                invoke: async (req) => {
                    const extracted = req.extensions.get(REQUEST_ID);
                    return HttpResponse.builder().body(extracted ?? "none");
                },
            };

            const layer = SetRequestIdLayer.default();
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().body(null);
            const res = await wrapped.invoke(req);

            assert.match(
                await consumers.text(res.body.readable),
                /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
            );
        });

        it("uses existing request ID from header", async () => {
            const innerService: HttpService = {
                invoke: async (req) => {
                    const extracted = req.extensions.get(REQUEST_ID);
                    return HttpResponse.builder().body(extracted ?? "none");
                },
            };

            const layer = new SetRequestIdLayer("x-request-id", () => "should-not-be-used");
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().header("x-request-id", "abc-123").body(null);
            const res = await wrapped.invoke(req);

            assert.equal(await consumers.text(res.body.readable), "abc-123");
        });

        it("generates request ID when none is present", async () => {
            const innerService: HttpService = {
                invoke: async (req) => {
                    const fromHeader = req.headers.get("x-custom-id")?.value;
                    const fromExt = req.extensions.get(REQUEST_ID);
                    return HttpResponse.builder().body(`${fromHeader} ${fromExt}`);
                },
            };

            const layer = new SetRequestIdLayer("x-custom-id", () => "generated-id");
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().body(null);
            const res = await wrapped.invoke(req);

            assert.equal(await consumers.text(res.body.readable), "generated-id generated-id");
        });

        it("does nothing if ID generation returns null", async () => {
            const innerService: HttpService = {
                invoke: async (req) => {
                    const val = req.headers.get("x-request-id");
                    return HttpResponse.builder().body(val?.value ?? "missing");
                },
            };

            const layer = new SetRequestIdLayer("x-request-id", () => null);
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().body(null);
            const res = await wrapped.invoke(req);

            assert.equal(await consumers.text(res.body.readable), "missing");
        });
    });

    describe("PropagateRequestIdLayer", () => {
        it("copies request ID from request to response header if missing", async () => {
            const innerService: HttpService = {
                invoke: async () => HttpResponse.builder().body("ok"),
            };

            const layer = new PropagateRequestIdLayer("x-request-id");
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().header("x-request-id", "abc-xyz").body(null);

            const res = await wrapped.invoke(req);

            assert.equal(res.headers.get("x-request-id")?.value, "abc-xyz");
            assert.equal(res.extensions.get(REQUEST_ID), "abc-xyz");
        });

        it("preserves existing response request ID", async () => {
            const innerService: HttpService = {
                invoke: async () =>
                    HttpResponse.builder().header("x-request-id", "from-response").body("ok"),
            };

            const layer = PropagateRequestIdLayer.default();
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().header("x-request-id", "from-request").body(null);

            const res = await wrapped.invoke(req);

            assert.equal(res.headers.get("x-request-id")?.value, "from-response");
            assert.equal(res.extensions.get(REQUEST_ID), "from-response");
        });

        it("does not overwrite existing extension", async () => {
            const innerService: HttpService = {
                invoke: async () =>
                    HttpResponse.builder()
                        .header("x-request-id", "new-id")
                        .extension(REQUEST_ID, "existing-id")
                        .body("ok"),
            };

            const layer = PropagateRequestIdLayer.default();
            const wrapped = layer.layer(innerService);

            const req = HttpRequest.builder().header("x-request-id", "ignored").body(null);

            const res = await wrapped.invoke(req);

            assert.equal(res.extensions.get(REQUEST_ID), "existing-id");
        });
    });
});
