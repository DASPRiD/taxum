import assert from "node:assert/strict";
import { describe, it } from "node:test";
import util from "node:util";
import { Method } from "../../src/http/index.js";

describe("http:method", () => {
    describe("Method", () => {
        it("has standard HTTP methods as static properties", () => {
            assert.equal(Method.CONNECT.value, "CONNECT");
            assert.equal(Method.DELETE.value, "DELETE");
            assert.equal(Method.GET.value, "GET");
            assert.equal(Method.HEAD.value, "HEAD");
            assert.equal(Method.OPTIONS.value, "OPTIONS");
            assert.equal(Method.PATCH.value, "PATCH");
            assert.equal(Method.POST.value, "POST");
            assert.equal(Method.PUT.value, "PUT");
            assert.equal(Method.TRACE.value, "TRACE");
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
            assert.equal(Method.fromString("GET"), Method.GET);
            assert.equal(Method.fromString("POST"), Method.POST);
        });

        it("fromString creates new Method instance for unknown methods", () => {
            const custom = Method.fromString("CUSTOM");
            assert.equal(custom.value, "CUSTOM");
            assert.notEqual(custom, Method.GET);
        });

        it("fromString is case-sensitive", () => {
            const lowerGet = Method.fromString("get");
            assert.equal(lowerGet.value, "get");
            assert.notEqual(lowerGet, Method.GET);
        });

        it("toJSON returns string value", () => {
            assert.equal(Method.GET.toJSON(), "GET");
        });

        it("custom inspect returns string value", () => {
            assert.equal(util.inspect(Method.GET), "'GET'");
        });
    });
});
