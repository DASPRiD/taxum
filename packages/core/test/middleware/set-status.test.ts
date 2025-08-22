import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse, StatusCode } from "../../src/http/index.js";
import { SetStatusLayer } from "../../src/middleware/set-status.js";

describe("middleware:set-status", () => {
    it("overrides the status code of a response", async () => {
        const innerService = {
            invoke: async () => HttpResponse.builder().status(StatusCode.OK).body("unchanged"),
        };

        const layer = new SetStatusLayer(StatusCode.CREATED);
        const wrappedService = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await wrappedService.invoke(req);

        assert.equal(res.status, StatusCode.CREATED);
        assert.equal(await consumers.text(res.body.readable), "unchanged");
    });

    it("applies the status code even if the original status was an error", async () => {
        const innerService = {
            invoke: async () => HttpResponse.builder().status(StatusCode.BAD_REQUEST).body("oops"),
        };

        const layer = new SetStatusLayer(StatusCode.NO_CONTENT);
        const wrappedService = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await wrappedService.invoke(req);

        assert.equal(res.status, StatusCode.NO_CONTENT);
        assert.equal(await consumers.text(res.body.readable), "oops");
    });

    it("works with empty bodies", async () => {
        const innerService = {
            invoke: async () => HttpResponse.builder().status(StatusCode.OK).body(null),
        };

        const layer = new SetStatusLayer(StatusCode.RESET_CONTENT);
        const wrappedService = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);
        const res = await wrappedService.invoke(req);

        assert.equal(res.status, StatusCode.RESET_CONTENT);
        assert.equal(await consumers.text(res.body.readable), "");
    });
});
