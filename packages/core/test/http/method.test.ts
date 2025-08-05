import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Method } from "../../src/http/index.js";

describe("http:method", () => {
    describe("Method", () => {
        it("has standard HTTP methods as static properties", () => {
            assert.equal(Method.CONNECT.toValue(), "CONNECT");
            assert.equal(Method.DELETE.toValue(), "DELETE");
            assert.equal(Method.GET.toValue(), "GET");
            assert.equal(Method.HEAD.toValue(), "HEAD");
            assert.equal(Method.OPTIONS.toValue(), "OPTIONS");
            assert.equal(Method.PATCH.toValue(), "PATCH");
            assert.equal(Method.POST.toValue(), "POST");
            assert.equal(Method.PUT.toValue(), "PUT");
            assert.equal(Method.TRACE.toValue(), "TRACE");
        });

        it("equals returns true for same Method instance", () => {
            assert.equal(Method.GET.equals(Method.GET), true);
        });

        it("equals returns true for matching string", () => {
            assert.equal(Method.POST.equals("POST"), true);
        });

        it("equals returns false for different string or method", () => {
            assert.equal(Method.PUT.equals("POST"), false);
            assert.equal(Method.DELETE.equals(Method.GET), false);
        });

        it("fromString returns known static instance for standard methods", () => {
            assert.strictEqual(Method.fromString("GET"), Method.GET);
            assert.strictEqual(Method.fromString("POST"), Method.POST);
        });

        it("fromString creates new Method instance for unknown methods", () => {
            const custom = Method.fromString("CUSTOM");
            assert.equal(custom.toValue(), "CUSTOM");
            assert.notEqual(custom, Method.GET);
        });

        it("fromString is case-sensitive", () => {
            const lowerGet = Method.fromString("get");
            assert.equal(lowerGet.toValue(), "get");
            assert.notEqual(lowerGet, Method.GET);
        });

        it("toString returns formatted string", () => {
            assert.equal(Method.GET.toString(), "Method(GET)");
            const custom = Method.fromString("MYMETHOD");
            assert.equal(custom.toString(), "Method(MYMETHOD)");
        });

        it("toValue returns the method string", () => {
            assert.equal(Method.PATCH.toValue(), "PATCH");
            const custom = Method.fromString("SPECIAL");
            assert.equal(custom.toValue(), "SPECIAL");
        });
    });
});
