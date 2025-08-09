import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, Method, Parts } from "../../../src/http/index.js";
import { AllowMethods } from "../../../src/layer/cors/index.js";

describe("layer:cors:allow-methods", () => {
    const partsWithRequestMethod = new Parts(
        Method.GET,
        new URL("http://localhost"),
        "1.1",
        new HeaderMap(new Map([["access-control-request-method", ["POST"]]])),
    );

    const partsWithoutRequestMethod = new Parts(
        Method.GET,
        new URL("http://localhost"),
        "1.1",
        new HeaderMap(),
    );

    it("default returns none", () => {
        const am = AllowMethods.default();
        assert.equal(am.toHeader(partsWithRequestMethod), null);
    });

    it("none returns null header", () => {
        const am = AllowMethods.none();
        assert.equal(am.toHeader(partsWithRequestMethod), null);
    });

    it("any returns wildcard *", () => {
        const am = AllowMethods.any();
        assert(am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            "*",
        ]);
    });

    it("exact returns single method string", () => {
        const am = AllowMethods.exact("PATCH");
        assert(!am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            "PATCH",
        ]);
    });

    it("list returns joined methods string", () => {
        const am = AllowMethods.list(["PUT", "DELETE"]);
        assert(!am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            "PUT,DELETE",
        ]);
    });

    it("mirrorRequest mirrors access-control-request-method when present", () => {
        const am = AllowMethods.mirrorRequest();
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            "POST",
        ]);
    });

    it("mirrorRequest returns null if access-control-request-method not present", () => {
        const am = AllowMethods.mirrorRequest();
        assert.equal(am.toHeader(partsWithoutRequestMethod), null);
    });

    it("isWildcard returns true only for *", () => {
        assert(AllowMethods.any().isWildcard());
        assert(!AllowMethods.none().isWildcard());
        assert(!AllowMethods.exact("GET").isWildcard());
    });
});
