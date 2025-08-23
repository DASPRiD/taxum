import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, HeaderValue, Method, Parts } from "../../../src/http/index.js";
import {
    AllowPrivateNetwork,
    type AllowPrivateNetworkPredicate,
} from "../../../src/middleware/cors/index.js";

describe("middleware:cors:allow-private-network", () => {
    const createParts = (allow?: boolean): Parts => {
        const headers = new HeaderMap();

        if (allow !== undefined) {
            headers.insert("access-control-request-private-network", allow ? "true" : "false");
        }

        return new Parts(Method.GET, new URL("http://localhost"), "1.1", headers);
    };

    it("default returns no", () => {
        const apn = AllowPrivateNetwork.default();
        assert.equal(apn.toHeader(new HeaderValue("https://example.com"), createParts()), null);
    });

    it("yes returns header if request header is 'true'", () => {
        const apn = AllowPrivateNetwork.yes();
        assert.deepEqual(apn.toHeader(new HeaderValue("https://example.com"), createParts(true)), [
            "access-control-allow-private-network",
            new HeaderValue("true"),
        ]);
        assert.equal(
            apn.toHeader(new HeaderValue("https://example.com"), createParts(false)),
            null,
        );

        const fromApn = AllowPrivateNetwork.from(true);
        assert.deepEqual(fromApn, apn);
    });

    it("no returns null regardless of request header", () => {
        const apn = AllowPrivateNetwork.no();
        assert.equal(apn.toHeader(new HeaderValue("https://example.com"), createParts(true)), null);
        assert.equal(
            apn.toHeader(new HeaderValue("https://example.com"), createParts(false)),
            null,
        );

        const fromApn = AllowPrivateNetwork.from(false);
        assert.deepEqual(fromApn, apn);
    });

    it("predicate returns header only if predicate returns true and request header is 'true'", () => {
        const pred: AllowPrivateNetworkPredicate = (origin) => origin === "https://allowed.com";
        const apn = AllowPrivateNetwork.predicate(pred);

        assert.deepEqual(apn.toHeader(new HeaderValue("https://allowed.com"), createParts(true)), [
            "access-control-allow-private-network",
            new HeaderValue("true"),
        ]);
        assert.equal(
            apn.toHeader(new HeaderValue("https://notallowed.com"), createParts(true)),
            null,
        );
        assert.equal(
            apn.toHeader(new HeaderValue("https://allowed.com"), createParts(false)),
            null,
        );

        const fromApn = AllowPrivateNetwork.from(pred);
        assert.deepEqual(fromApn, apn);
    });

    it("toHeader returns null if origin is null and inner is predicate", () => {
        const pred: AllowPrivateNetworkPredicate = () => true;
        const apn = AllowPrivateNetwork.predicate(pred);

        assert.equal(apn.toHeader(null, createParts(true)), null);
    });

    it("returns original instance from from()", () => {
        const apn = AllowPrivateNetwork.default();
        assert.equal(AllowPrivateNetwork.from(apn), apn);
    });
});
