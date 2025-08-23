import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, HeaderValue, Method, Parts } from "../../../src/http/index.js";
import { AllowHeaders, ANY, MIRROR_REQUEST } from "../../../src/middleware/cors/index.js";

describe("middleware:cors:allow-headers", () => {
    const partsWithRequestHeaders = new Parts(
        Method.GET,
        new URL("http://localhost"),
        "1.1",
        HeaderMap.from([["access-control-request-headers", "X-Custom-Header, X-Another-Header"]]),
    );

    const partsWithoutRequestHeaders = new Parts(
        Method.GET,
        new URL("http://localhost"),
        "1.1",
        new HeaderMap(),
    );

    it("default returns none", () => {
        const ah = AllowHeaders.default();
        assert.equal(ah.toHeader(partsWithRequestHeaders), null);
    });

    it("none returns null header", () => {
        const ah = AllowHeaders.none();
        assert.equal(ah.toHeader(partsWithRequestHeaders), null);

        const fromAh = AllowHeaders.from(null);
        assert.deepEqual(fromAh, ah);
    });

    it("any returns wildcard *", () => {
        const ah = AllowHeaders.any();
        assert(ah.isWildcard());
        assert.deepEqual(ah.toHeader(partsWithRequestHeaders), [
            "access-control-allow-headers",
            new HeaderValue("*"),
        ]);

        const fromAh = AllowHeaders.from(ANY);
        assert.deepEqual(fromAh, ah);
    });

    it("list returns joined headers string", () => {
        const ah = AllowHeaders.list(["X-Foo", "X-Bar"]);
        assert(!ah.isWildcard());
        assert.deepEqual(ah.toHeader(partsWithRequestHeaders), [
            "access-control-allow-headers",
            new HeaderValue("X-Foo,X-Bar"),
        ]);

        const fromAh = AllowHeaders.from(["X-Foo", "X-Bar"]);
        assert.deepEqual(fromAh, ah);
    });

    it("mirrorRequest mirrors access-control-request-headers when present", () => {
        const ah = AllowHeaders.mirrorRequest();
        assert.deepEqual(ah.toHeader(partsWithRequestHeaders), [
            "access-control-allow-headers",
            new HeaderValue("X-Custom-Header, X-Another-Header"),
        ]);

        const fromAh = AllowHeaders.from(MIRROR_REQUEST);
        assert.deepEqual(fromAh, ah);
    });

    it("mirrorRequest returns null if access-control-request-headers not present", () => {
        const ah = AllowHeaders.mirrorRequest();
        assert.equal(ah.toHeader(partsWithoutRequestHeaders), null);
    });

    it("isWildcard returns true only for *", () => {
        assert(AllowHeaders.any().isWildcard());
        assert(!AllowHeaders.none().isWildcard());
        assert(!AllowHeaders.list(["X"]).isWildcard());
    });

    it("returns original instance from from()", () => {
        const ah = AllowHeaders.default();
        assert.equal(AllowHeaders.from(ah), ah);
    });
});
