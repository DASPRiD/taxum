import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import {
    Body,
    HeaderMap,
    HttpRequest,
    HttpResponse,
    Method,
    Parts,
    StatusCode,
} from "@taxum/core/http";

const createRequest = (authorization?: string): HttpRequest => {
    const headers = new HeaderMap();

    if (authorization) {
        headers.insert("authorization", authorization);
    }

    const parts = new Parts(Method.GET, new URL("http://localhost"), "1.1", headers);
    return new HttpRequest(parts, Body.from(null));
};

describe("JwtLayer", () => {
    const jwtVerifyMock =
        mock.fn<(token: unknown, key: unknown, options: unknown) => Promise<unknown>>();
    let JWT: typeof import("../src/index.js").JWT;
    let JwtLayer: typeof import("../src/index.js").JwtLayer;
    let UnauthorizedError: typeof import("../src/index.js").UnauthorizedError;

    before(async () => {
        mock.module("jose", {
            namedExports: {
                jwtVerify: jwtVerifyMock,
            },
        });

        ({ JWT, JwtLayer, UnauthorizedError } = await import("../src/index.js"));
    });

    beforeEach(() => {
        jwtVerifyMock.mock.resetCalls();
    });

    it("rejects missing authorization header", async () => {
        const layer = new JwtLayer(new Uint8Array());
        const req = createRequest();

        const service = layer.layer({
            invoke: () => {
                throw new Error("should not be called");
            },
        });

        await assert.rejects(
            async () => service.invoke(req),
            new UnauthorizedError("Missing authorization header", false),
        );
    });

    it("rejects malformed authorization header", async () => {
        const layer = new JwtLayer(new Uint8Array());
        const req = createRequest("Token abc123");

        const service = layer.layer({
            invoke: () => {
                throw new Error("should not be called");
            },
        });

        await assert.rejects(
            async () => service.invoke(req),
            new UnauthorizedError("Malformed authorization header", false),
        );
    });

    it("returns error message when debug is enabled", async () => {
        const layer = new JwtLayer(new Uint8Array()).debug(true);
        const req = createRequest("Bearer invalid.jwt.token");

        jwtVerifyMock.mock.mockImplementationOnce(() => {
            throw new Error("bad signature");
        });

        const service = layer.layer({
            invoke: () => {
                throw new Error("should not be called");
            },
        });

        await assert.rejects(
            async () => service.invoke(req),
            new UnauthorizedError("bad signature", true),
        );
    });

    it("throws 401 on invalid JWT and debug is disabled", async () => {
        const layer = new JwtLayer(new Uint8Array());
        const req = createRequest("Bearer whatever");

        jwtVerifyMock.mock.mockImplementationOnce(() => {
            throw new Error("invalid");
        });

        const service = layer.layer({
            invoke: () => {
                throw new Error("should not be called");
            },
        });

        await assert.rejects(
            async () => service.invoke(req),
            new UnauthorizedError("invalid", false),
        );
    });

    it("allows request through if allowUnauthorized is true", async () => {
        const layer = new JwtLayer(new Uint8Array()).allowUnauthorized(true);
        const req = createRequest("Bearer bad");

        jwtVerifyMock.mock.mockImplementationOnce(() => {
            throw new Error("bad jwt");
        });

        let innerCalled = false;

        const service = layer.layer({
            invoke: () => {
                innerCalled = true;
                return new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("ok"));
            },
        });

        const res = await service.invoke(req);
        assert(innerCalled);
        assert.equal(res.status.code, StatusCode.OK.code);
    });

    it("injects JWT verification result into request.extensions", async () => {
        const payload = { sub: "123", aud: "abc" };
        const layer = new JwtLayer(new Uint8Array());
        const req = createRequest("Bearer valid.token");

        jwtVerifyMock.mock.mockImplementationOnce(() => Promise.resolve(payload));

        const service = layer.layer({
            invoke: (req) => {
                const ext = req.extensions.get(JWT);
                assert.deepEqual(ext, payload);

                return new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("yes"));
            },
        });

        const res = await service.invoke(req);
        assert.equal(res.status.code, StatusCode.OK.code);
    });

    it("supports verifyOptions as static object", async () => {
        const req = createRequest("Bearer my.jwt.token");

        jwtVerifyMock.mock.mockImplementationOnce((_token, _key, options) => {
            assert.deepEqual(options, { audience: "abc" });
            return Promise.resolve({ aud: "abc" });
        });

        const layer = new JwtLayer(new Uint8Array()).verifyOptions({ audience: "abc" });
        const service = layer.layer({
            invoke: () => new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("done")),
        });

        const res = await service.invoke(req);
        assert.equal(res.status.code, StatusCode.OK.code);
    });

    it("supports verifyOptions as function", async () => {
        const req = createRequest("Bearer my.jwt.token");

        jwtVerifyMock.mock.mockImplementationOnce((_token, _key, options) => {
            assert.deepEqual(options, { audience: "dynamic" });
            return Promise.resolve({ aud: "dynamic" });
        });

        const layer = new JwtLayer(new Uint8Array()).verifyOptions(() => ({ audience: "dynamic" }));
        const service = layer.layer({
            invoke: () => new HttpResponse(StatusCode.OK, new HeaderMap(), Body.from("done")),
        });

        const res = await service.invoke(req);
        assert.equal(res.status.code, StatusCode.OK.code);
    });
});
