import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, HeaderValue, Method, Parts } from "../../../src/http/index.js";
import { type DynamicMaxAge, MaxAge } from "../../../src/middleware/cors/index.js";

describe("middleware:cors:max-age", () => {
    const parts = new Parts(Method.GET, new URL("http://localhost"), "1.1", new HeaderMap());

    it("default returns none", () => {
        const maxAge = MaxAge.default();
        assert.equal(maxAge.toHeader(new HeaderValue("https://example.com"), parts), null);
    });

    it("none returns null", () => {
        const maxAge = MaxAge.none();
        assert.equal(maxAge.toHeader(new HeaderValue("https://example.com"), parts), null);

        const fromMaxAge = MaxAge.from(null);
        assert.deepEqual(fromMaxAge, maxAge);
    });

    it("exact returns header with string value", () => {
        const maxAge = MaxAge.exact(3600);
        assert.deepEqual(maxAge.toHeader(new HeaderValue("https://example.com"), parts), [
            "access-control-max-age",
            new HeaderValue("3600"),
        ]);

        const fromMaxAge = MaxAge.from(3600);
        assert.deepEqual(fromMaxAge, maxAge);
    });

    it("dynamic returns header with function result", () => {
        const fn: DynamicMaxAge = (origin, p) => {
            assert.equal(origin, "https://example.com");
            assert.strictEqual(p, parts);
            return 1234;
        };
        const maxAge = MaxAge.dynamic(fn);
        assert.deepEqual(maxAge.toHeader(new HeaderValue("https://example.com"), parts), [
            "access-control-max-age",
            new HeaderValue("1234"),
        ]);

        const fromMaxAge = MaxAge.from(fn);
        assert.deepEqual(fromMaxAge, maxAge);
    });

    it("dynamic returns null if origin is null", () => {
        const fn: DynamicMaxAge = () => 1234;
        const maxAge = MaxAge.dynamic(fn);
        assert.equal(maxAge.toHeader(null, parts), null);
    });

    it("returns original instance from from()", () => {
        const maxAge = MaxAge.default();
        assert.equal(MaxAge.from(maxAge), maxAge);
    });
});
