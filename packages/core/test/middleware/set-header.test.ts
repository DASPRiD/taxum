import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, type HeadersArray, HttpRequest, HttpResponse } from "../../src/http/index.js";
import { SetRequestHeaderLayer, SetResponseHeaderLayer } from "../../src/middleware/set-header.js";
import type { HttpService } from "../../src/service/index.js";

const makeService = (res: HttpResponse) => ({
    invoke: async () => res,
});

const makeRequest = (headers: HeadersArray = []) =>
    HttpRequest.builder().headers(HeaderMap.fromArray(headers)).body(null);
const makeResponse = (headers: HeadersArray = []) =>
    HttpResponse.builder().headers(HeaderMap.fromArray(headers)).body(null);

describe("middleware:set-header", () => {
    describe("SetResponseHeaderLayer", () => {
        it("overrides an existing header", async () => {
            const inner = makeService(makeResponse([["X-Test", "old"]]));
            const layer = SetResponseHeaderLayer.overriding("X-Test", "new");
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert.equal(res.headers.get("X-Test"), "new");
        });

        it("overrides using a function maker", async () => {
            const inner = makeService(makeResponse());
            const layer = SetResponseHeaderLayer.overriding("X-Func", () => "dynamic");
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert.equal(res.headers.get("X-Func"), "dynamic");
        });

        it("does nothing if make returns null (override)", async () => {
            const inner = makeService(makeResponse());
            const layer = SetResponseHeaderLayer.overriding("X-Null", null);
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert(!res.headers.containsKey("X-Null"));
        });

        it("appends a header value alongside existing ones", async () => {
            const inner = makeService(makeResponse([["X-Multi", "a"]]));
            const layer = SetResponseHeaderLayer.appending("X-Multi", "b");
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert.deepEqual(res.headers.getAll("X-Multi"), ["a", "b"]);
        });

        it("does not append if value is null", async () => {
            const inner = makeService(makeResponse([["X-Multi", "a"]]));
            const layer = SetResponseHeaderLayer.appending("X-Multi", null);
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert.deepEqual(res.headers.getAll("X-Multi"), ["a"]);
        });

        it("sets header only if not present", async () => {
            const inner = makeService(makeResponse());
            const layer = SetResponseHeaderLayer.ifNotPresent("X-Opt", "val");
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert.equal(res.headers.get("X-Opt"), "val");
        });

        it("does not overwrite if already present (ifNotPresent)", async () => {
            const inner = makeService(makeResponse([["X-Opt", "exists"]]));
            const layer = SetResponseHeaderLayer.ifNotPresent("X-Opt", "new");
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            assert.equal(res.headers.get("X-Opt"), "exists");
        });
    });

    describe("SetRequestHeaderLayer", () => {
        it("overrides request header before service sees it", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = SetRequestHeaderLayer.overriding("X-Test", "overridden");
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest([["X-Test", "old"]]));
            assert(seenReq);
            assert.equal(seenReq.headers.get("X-Test"), "overridden");
        });

        it("appends multiple values to request header", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = SetRequestHeaderLayer.appending("X-Multi", "b");
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest([["X-Multi", "a"]]));
            assert(seenReq);
            assert.deepEqual(seenReq.headers.getAll("X-Multi"), ["a", "b"]);
        });

        it("does not insert header if already present (ifNotPresent)", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = SetRequestHeaderLayer.ifNotPresent("X-Opt", "new");
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest([["X-Opt", "exists"]]));
            assert(seenReq);
            assert.equal(seenReq.headers.get("X-Opt"), "exists");
        });

        it("inserts header if missing (ifNotPresent)", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = SetRequestHeaderLayer.ifNotPresent("X-Opt", () => "gen");
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest());
            assert(seenReq);
            assert.equal(seenReq.headers.get("X-Opt"), "gen");
        });

        it("ignores null values (request headers)", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = SetRequestHeaderLayer.overriding("X-Null", null);
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest());
            assert(seenReq);
            assert(!seenReq.headers.containsKey("X-Null"));
        });
    });
});
