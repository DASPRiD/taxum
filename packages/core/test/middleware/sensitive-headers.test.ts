import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    type HeaderEntryLike,
    HeaderMap,
    HttpRequest,
    HttpResponse,
} from "../../src/http/index.js";
import {
    SetSensitiveHeadersLayer,
    SetSensitiveRequestHeadersLayer,
    SetSensitiveResponseHeadersLayer,
} from "../../src/middleware/sensitive-headers.js";
import type { HttpService } from "../../src/service/index.js";

const makeService = (res: HttpResponse): HttpService => ({
    invoke: async () => res,
});

const makeRequest = (headers: HeaderEntryLike[] = []) =>
    HttpRequest.builder().headers(HeaderMap.from(headers)).body(null);
const makeResponse = (headers: [string, string][] = []) =>
    HttpResponse.builder().headers(HeaderMap.from(headers)).body(null);

describe("middleware:set-sensitive-headers", () => {
    describe("SetSensitiveRequestHeadersLayer", () => {
        it("marks request headers as sensitive", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = new SetSensitiveRequestHeadersLayer(["X-Sensitive"]);
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest([["X-Sensitive", "secret"]]));

            assert(seenReq);
            const values = seenReq.headers.getAll("X-Sensitive");
            assert.equal(values.length, 1);
            assert(values[0].isSensitive(), "expected header to be marked sensitive");
        });

        it("ignores headers not listed", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse();
                },
            };

            const layer = new SetSensitiveRequestHeadersLayer(["X-Other"]);
            const svc = layer.layer(inner);

            await svc.invoke(makeRequest([["X-Sensitive", "secret"]]));

            assert(seenReq);
            const values = seenReq.headers.getAll("X-Sensitive");
            assert(values.every((v) => !v.isSensitive()));
        });
    });

    describe("SetSensitiveResponseHeadersLayer", () => {
        it("marks response headers as sensitive", async () => {
            const inner = makeService(makeResponse([["X-Sensitive", "secret"]]));
            const layer = new SetSensitiveResponseHeadersLayer(["X-Sensitive"]);
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            const values = res.headers.getAll("X-Sensitive");
            assert.equal(values.length, 1);
            assert(values[0].isSensitive(), "expected header to be marked sensitive");
        });

        it("ignores headers not listed", async () => {
            const inner = makeService(makeResponse([["X-Sensitive", "secret"]]));
            const layer = new SetSensitiveResponseHeadersLayer(["X-Other"]);
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest());
            const values = res.headers.getAll("X-Sensitive");
            assert(values.every((v) => !v.isSensitive()));
        });
    });

    describe("SetSensitiveHeadersLayer (combined)", () => {
        it("marks both request and response headers as sensitive", async () => {
            let seenReq: HttpRequest | undefined;
            const inner: HttpService = {
                invoke: async (req) => {
                    seenReq = req;
                    return makeResponse([["X-Sensitive", "resp-secret"]]);
                },
            };

            const layer = new SetSensitiveHeadersLayer(["X-Sensitive"]);
            const svc = layer.layer(inner);

            const res = await svc.invoke(makeRequest([["X-Sensitive", "req-secret"]]));

            assert(seenReq);
            const reqValues = seenReq.headers.getAll("X-Sensitive");
            assert(reqValues.every((v) => v.isSensitive()));

            const resValues = res.headers.getAll("X-Sensitive");
            assert(resValues.every((v) => v.isSensitive()));
        });
    });
});
