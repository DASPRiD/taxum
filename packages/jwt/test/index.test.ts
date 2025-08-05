import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { before, describe, it, mock } from "node:test";
import { Body, HeaderMap, HttpRequest, HttpResponse, Parts, StatusCode } from "@taxum/core/http";
import type { JwtConfig } from "../src/index.js";

const createRequest = (authorization?: string): HttpRequest => {
    const headers = new HeaderMap();

    if (authorization) {
        headers.insert("authorization", authorization);
    }

    const parts = new Parts(Method.GET, new URL("http://localhost"), "1.1", headers);
    return new HttpRequest(parts, Readable.from([]));
};

describe("jwtLayer", () => {
    const jwtVerifyMock =
        mock.fn<(token: unknown, key: unknown, options: unknown) => Promise<unknown>>();
    let JWT: typeof import("../src/index.js")["JWT"];
    let jwtLayer: typeof import("../src/index.js")["jwtLayer"];

    before(async () => {
        mock.module("jose", {
            namedExports: {
                jwtVerify: jwtVerifyMock,
            },
        });

        ({ JWT, jwtLayer } = await import("../src/index.js"));
    });

    it("rejects missing authorization header", async () => {
        const config: JwtConfig = { key: new Uint8Array() };
        const layer = jwtLayer(config);
        const req = createRequest();

        const handler = layer.layer(() => {
            throw new Error("should not be called");
        });

        const res = await handler(req);
        assert(res instanceof HttpResponse);
        assert.equal(res.status.code, StatusCode.UNAUTHORIZED.code);
        assert.equal(res.body, null);
    });

    it("rejects malformed authorization header", async () => {
        const config: JwtConfig = { key: new Uint8Array() };
        const layer = jwtLayer(config);
        const req = createRequest("Token abc123");

        const handler = layer.layer(() => {
            throw new Error("should not be called");
        });

        const res = await handler(req);
        assert.equal(res.status.code, StatusCode.UNAUTHORIZED.code);
    });

    it("returns error message when debug is enabled", async () => {
        const config: JwtConfig = { key: new Uint8Array(), debug: true };
        const layer = jwtLayer(config);
        const req = createRequest("Bearer invalid.jwt.token");

        jwtVerifyMock.mock.mockImplementationOnce(() => {
            throw new Error("bad signature");
        });

        const handler = layer.layer(() => {
            throw new Error("should not be called");
        });

        const res = await handler(req);
        assert.equal(res.status.code, StatusCode.UNAUTHORIZED.code);
        assert.equal(res.body, "bad signature");
    });

    it("returns 401 on invalid JWT and debug is disabled", async () => {
        const config: JwtConfig = { key: new Uint8Array(), debug: false };
        const layer = jwtLayer(config);
        const req = createRequest("Bearer whatever");

        jwtVerifyMock.mock.mockImplementationOnce(() => {
            throw new Error("invalid");
        });

        const handler = layer.layer(() => {
            throw new Error("should not be called");
        });

        const res = await handler(req);
        assert.equal(res.status.code, StatusCode.UNAUTHORIZED.code);
        assert.equal(res.body, null);
    });

    it("allows request through if allowUnauthorized is true", async () => {
        const config: JwtConfig = {
            key: new Uint8Array(),
            allowUnauthorized: true,
        };
        const layer = jwtLayer(config);
        const req = createRequest("Bearer bad");

        jwtVerifyMock.mock.mockImplementationOnce(() => {
            throw new Error("bad jwt");
        });

        let innerCalled = false;

        const handler = layer.layer(() => {
            innerCalled = true;
            return Promise.resolve(
                new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("ok")),
            );
        });

        const res = await handler(req);
        assert(innerCalled);
        assert.equal(res.status.code, StatusCode.OK.code);
    });

    it("injects JWT verification result into request.extensions", async () => {
        const payload = { sub: "123", aud: "abc" };
        const config: JwtConfig = { key: new Uint8Array() };
        const layer = jwtLayer(config);
        const req = createRequest("Bearer valid.token");

        jwtVerifyMock.mock.mockImplementationOnce(() => Promise.resolve(payload));

        const handler = layer.layer((request) => {
            const ext = request.extensions.get(JWT);
            assert.deepEqual(ext, payload);
            return Promise.resolve(
                new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("yes")),
            );
        });

        const res = await handler(req);
        assert.equal(res.status.code, StatusCode.OK.code);
    });

    it("supports verifyOptions as static object", async () => {
        const config: JwtConfig = {
            key: new Uint8Array(),
            verifyOptions: { audience: "abc" },
        };

        const req = createRequest("Bearer my.jwt.token");

        jwtVerifyMock.mock.mockImplementationOnce((_token, _key, options) => {
            assert.deepEqual(options, { audience: "abc" });
            return Promise.resolve({ aud: "abc" });
        });

        const layer = jwtLayer(config);
        const handler = layer.layer(() =>
            Promise.resolve(new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("done"))),
        );

        const res = await handler(req);
        assert.equal(res.status.code, StatusCode.OK.code);
    });

    it("supports verifyOptions as function", async () => {
        const config: JwtConfig = {
            key: new Uint8Array(),
            verifyOptions: () => ({ audience: "dynamic" }),
        };

        const req = createRequest("Bearer my.jwt.token");

        jwtVerifyMock.mock.mockImplementationOnce((_token, _key, options) => {
            assert.deepEqual(options, { audience: "dynamic" });
            return Promise.resolve({ aud: "dynamic" });
        });

        const layer = jwtLayer(config);
        const handler = layer.layer(() =>
            Promise.resolve(new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("done"))),
        );

        const res = await handler(req);
        assert.equal(res.status.code, StatusCode.OK.code);
    });
});
