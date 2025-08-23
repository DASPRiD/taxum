import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, HeaderValue, Method, Parts } from "../../../src/http/index.js";
import { AllowMethods, ANY, MIRROR_REQUEST } from "../../../src/middleware/cors/index.js";

describe("middleware:cors:allow-methods", () => {
    const partsWithRequestMethod = new Parts(
        Method.GET,
        new URL("http://localhost"),
        "1.1",
        HeaderMap.from([["access-control-request-method", "POST"]]),
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

        const fromAm = AllowMethods.from(null);
        assert.deepEqual(fromAm, am);
    });

    it("any returns wildcard *", () => {
        const am = AllowMethods.any();
        assert(am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            new HeaderValue("*"),
        ]);

        const fromAm = AllowMethods.from(ANY);
        assert.deepEqual(fromAm, am);
    });

    it("exact returns single method string", () => {
        const am = AllowMethods.exact("PATCH");
        assert(!am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            new HeaderValue("PATCH"),
        ]);

        const fromAm = AllowMethods.from("PATCH");
        assert.deepEqual(fromAm, am);
    });

    it("exact with Method instance returns single method string", () => {
        const am = AllowMethods.exact(Method.PATCH);
        assert(!am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            new HeaderValue("PATCH"),
        ]);

        const fromAm = AllowMethods.from(Method.PATCH);
        assert.deepEqual(fromAm, am);
    });

    it("list returns joined methods string", () => {
        const am = AllowMethods.list(["PUT", "DELETE"]);
        assert(!am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            new HeaderValue("PUT,DELETE"),
        ]);

        const fromAm = AllowMethods.from(["PUT", "DELETE"]);
        assert.deepEqual(fromAm, am);
    });

    it("list with Method instances returns joined methods string", () => {
        const am = AllowMethods.list([Method.PUT, Method.DELETE]);
        assert(!am.isWildcard());
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            new HeaderValue("PUT,DELETE"),
        ]);

        const fromAm = AllowMethods.from([Method.PUT, Method.DELETE]);
        assert.deepEqual(fromAm, am);
    });

    it("mirrorRequest mirrors access-control-request-method when present", () => {
        const am = AllowMethods.mirrorRequest();
        assert.deepEqual(am.toHeader(partsWithRequestMethod), [
            "access-control-allow-methods",
            new HeaderValue("POST"),
        ]);

        const fromAm = AllowMethods.from(MIRROR_REQUEST);
        assert.deepEqual(fromAm, am);
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

    it("returns original instance from from()", () => {
        const am = AllowMethods.default();
        assert.equal(AllowMethods.from(am), am);
    });
});
