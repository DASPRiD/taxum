import assert from "node:assert/strict";
import { Readable } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import {
    Body,
    HttpRequest,
    HttpResponse,
    isToHttpResponse,
    StatusCode,
    TO_HTTP_RESPONSE,
} from "../../src/http/index.js";
import { ContentTooLargeError, RequestBodyLimitLayer } from "../../src/middleware/limit.js";
import type { HttpService } from "../../src/service/index.js";

describe("middleware:limit", () => {
    it("passes through requests without content-length header", async () => {
        const inner: HttpService = {
            invoke: async () => HttpResponse.builder().body("ok"),
        };
        const layer = new RequestBodyLimitLayer(10);
        const service = layer.layer(inner);

        const req = HttpRequest.builder().body(Readable.from(["hello"]));
        const res = await service.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "ok");
    });

    it("throws 413 immediately if content-length exceeds limit", async () => {
        const inner: HttpService = {
            invoke: async () => {
                throw new Error("should not be called");
            },
        };
        const layer = new RequestBodyLimitLayer(5);
        const service = layer.layer(inner);

        const req = HttpRequest.builder()
            .header("content-length", "6")
            .body(Readable.from(["hello!"]));

        await assert.rejects(async () => service.invoke(req), new ContentTooLargeError(5));
    });

    it("passes through if content-length is equal or below limit", async () => {
        const inner: HttpService = {
            invoke: async (req) => {
                const bodyText = await consumers.text(req.body.readable);
                return HttpResponse.builder().body(bodyText);
            },
        };
        const layer = new RequestBodyLimitLayer(5);
        const service = layer.layer(inner);

        const req = HttpRequest.builder()
            .header("content-length", "5")
            .body(Readable.from(["hello"]));

        const res = await service.invoke(req);

        assert.equal(await consumers.text(res.body.readable), "hello");
    });

    it("returns 413 if stream emits more data than the limit", async () => {
        const inner: HttpService = {
            invoke: async (req) => {
                try {
                    await consumers.text(req.body.readable);
                    return HttpResponse.builder().body("should not reach here");
                } catch (err) {
                    if (isToHttpResponse(err)) {
                        return err[TO_HTTP_RESPONSE]();
                    }

                    throw err;
                }
            },
        };
        const layer = new RequestBodyLimitLayer(4);
        const service = layer.layer(inner);

        const req = HttpRequest.builder().header("content-length", "4").body(Body.from("hello"));

        const res = await service.invoke(req);

        assert.equal(res.status.code, StatusCode.CONTENT_TOO_LARGE.code);
    });
});
