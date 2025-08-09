import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, Method, Parts } from "../../../src/http/index.js";
import { AllowCredentials, type AllowCredentialsPredicate } from "../../../src/layer/cors/index.js";

describe("layer:cors:allow-credentials", () => {
    const parts = new Parts(Method.GET, new URL("http://localhost"), "1.1", new HeaderMap());

    it("default returns no", () => {
        const ac = AllowCredentials.default();
        assert.equal(ac.isTrue(), false);
    });

    it("yes returns true", () => {
        const ac = AllowCredentials.yes();
        assert.equal(ac.isTrue(), true);
        assert.deepEqual(ac.toHeader("https://example.com", parts), [
            "access-control-allow-credentials",
            "true",
        ]);
    });

    it("no returns false", () => {
        const ac = AllowCredentials.no();
        assert.equal(ac.isTrue(), false);
        assert.equal(ac.toHeader("https://example.com", parts), null);
    });

    it("predicate returns true when predicate returns true", () => {
        const pred: AllowCredentialsPredicate = (origin) => origin === "https://allowed.com";
        const ac = AllowCredentials.predicate(pred);

        assert.equal(ac.isTrue(), false);
        assert.deepEqual(ac.toHeader("https://allowed.com", parts), [
            "access-control-allow-credentials",
            "true",
        ]);

        assert.equal(ac.toHeader("https://notallowed.com", parts), null);
        assert.equal(ac.toHeader(null, parts), null);
    });

    it("toHeader returns header if origin is null and inner is boolean true", () => {
        const ac = AllowCredentials.yes();
        assert.deepEqual(ac.toHeader(null, parts), ["access-control-allow-credentials", "true"]);
    });

    it("toHeader returns null if predicate returns false", () => {
        const pred: AllowCredentialsPredicate = () => false;
        const ac = AllowCredentials.predicate(pred);
        assert.equal(ac.toHeader("https://any.com", parts), null);
    });
});
