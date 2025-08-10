import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, type HttpResponseLike } from "../../src/http/index.js";
import { MapToHttpResponse, type Service } from "../../src/routing/index.js";

describe("routing:util", () => {
    describe("MapToHttpResponse", () => {
        it("wraps inner response using HttpResponse.from", async () => {
            const inner: Service<HttpResponseLike> = {
                invoke: async () => [202, "hello"],
            };

            const wrapper = new MapToHttpResponse(inner);

            const req = HttpRequest.builder().method("GET").path("/").body(null);
            const res = await wrapper.invoke(req);

            assert.equal(res.status.code, 202);
            assert.equal(await consumers.text(res.body.read()), "hello");
        });
    });
});
