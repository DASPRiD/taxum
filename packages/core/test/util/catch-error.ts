import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import type { HttpService } from "../../src/service/index.js";
import { CatchError, CatchErrorLayer } from "../../src/util/index.js";

describe("util:map-to-http-response", () => {
    it("wraps service in CatchError", async () => {
        const inner: HttpService = {
            invoke: () => HttpResponse.builder().body(null),
        };
        const layer = new CatchErrorLayer();
        const wrapped = layer.layer(inner);
        assert(wrapped instanceof CatchError);
    });

    it("catches inner errors", async () => {
        const inner: HttpService = {
            invoke: () => {
                throw new Error("inner error");
            },
        };
        const wrapper = new CatchError(inner);

        const res = await wrapper.invoke(HttpRequest.builder().body(null));
        assert.equal(res.status, StatusCode.INTERNAL_SERVER_ERROR);
    });
});
