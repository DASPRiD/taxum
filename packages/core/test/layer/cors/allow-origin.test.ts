import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, Method, Parts } from "../../../src/http/index.js";
import { AllowOrigin, type AllowOriginPredicate } from "../../../src/layer/cors/index.js";

describe("layer:cors:allow-origin", () => {
    const parts = new Parts(Method.GET, new URL("http://localhost"), "1.1", new HeaderMap());

    it("default returns empty list, so toHeader returns null", async () => {
        const ao = AllowOrigin.default();
        assert(!ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://example.com", parts), null);
    });

    it("any returns wildcard * with toHeader returning *", async () => {
        const ao = AllowOrigin.any();
        assert(ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://example.com", parts), [
            "access-control-allow-origin",
            "*",
        ]);
    });

    it("exact returns exact origin", async () => {
        const ao = AllowOrigin.exact("https://allowed.com");
        assert(!ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://allowed.com", parts), [
            "access-control-allow-origin",
            "https://allowed.com",
        ]);
        assert.deepEqual(await ao.toHeader("https://notallowed.com", parts), [
            "access-control-allow-origin",
            "https://allowed.com",
        ]);
    });

    it("list throws if '*' included", () => {
        assert.throws(() => {
            AllowOrigin.list(["https://example.com", "*"]);
        }, /Wildcard origin \(`\*`\) cannot be passed/);
    });

    it("list returns origins and matches included origin", async () => {
        const ao = AllowOrigin.list(["https://allowed.com", "https://alsoallowed.com"]);
        assert(!ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://allowed.com", parts), [
            "access-control-allow-origin",
            "https://allowed.com",
        ]);
        assert.equal(await ao.toHeader("https://notallowed.com", parts), null);
    });

    it("predicate returns true if predicate returns true", async () => {
        const pred: AllowOriginPredicate = (origin) => origin === "https://allowed.com";
        const ao = AllowOrigin.predicate(pred);

        assert(!ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://allowed.com", parts), [
            "access-control-allow-origin",
            "https://allowed.com",
        ]);
        assert.equal(await ao.toHeader("https://notallowed.com", parts), null);
    });

    it("predicate can return Promise<boolean>", async () => {
        const pred: AllowOriginPredicate = async (origin) => origin === "https://allowed.com";
        const ao = AllowOrigin.predicate(pred);

        assert(!ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://allowed.com", parts), [
            "access-control-allow-origin",
            "https://allowed.com",
        ]);
        assert.equal(await ao.toHeader("https://notallowed.com", parts), null);
    });

    it("mirrorRequest returns true for any origin", async () => {
        const ao = AllowOrigin.mirrorRequest();
        assert(!ao.isWildcard());
        assert.deepEqual(await ao.toHeader("https://any.com", parts), [
            "access-control-allow-origin",
            "https://any.com",
        ]);
        assert.equal(await ao.toHeader(null, parts), null);
    });

    it("toHeader returns null if origin is null and inner is list or predicate", async () => {
        const aoList = AllowOrigin.list(["https://allowed.com"]);
        assert.equal(await aoList.toHeader(null, parts), null);

        const aoPred = AllowOrigin.predicate(() => true);
        assert.equal(await aoPred.toHeader(null, parts), null);
    });
});
