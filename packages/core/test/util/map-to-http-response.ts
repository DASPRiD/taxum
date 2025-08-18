import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse, type HttpResponseLike } from "../../src/http/index.js";
import type { HttpService } from "../../src/service/index.js";
import { MapToHttpResponse, MapToHttpResponseLayer } from "../../src/util/index.js";

describe("util:map-to-http-response", () => {
    it("wraps service in MapToHttpResponse", async () => {
        const inner: HttpService = {
            invoke: () => HttpResponse.builder().body(null),
        };
        const layer = new MapToHttpResponseLayer();
        const wrapped = layer.layer(inner);
        assert(wrapped instanceof MapToHttpResponse);
    });

    it("wraps inner response using HttpResponse.from", async () => {
        const inner: HttpService<HttpResponseLike> = {
            invoke: async () => [202, "hello"],
        };

        const wrapper = new MapToHttpResponse(inner);

        const req = HttpRequest.builder().method("GET").path("/").body(null);
        const res = await wrapper.invoke(req);

        assert.equal(res.status.code, 202);
        assert.equal(await consumers.text(res.body.read()), "hello");
    });
});
