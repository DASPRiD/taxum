import assert from "node:assert/strict";
import { describe, it } from "node:test";
import util from "node:util";
import { HeaderMap, HeaderValue } from "../../src/http/index.js";

describe("http:headers", () => {
    describe("HeaderMap", () => {
        it("constructs empty map without argument", () => {
            const map = new HeaderMap();
            assert(map.isEmpty());
            assert.equal(map.len(), 0);
        });

        it("constructs from Iterable and lowercases keys", () => {
            const map = new HeaderMap([
                ["Content-Type", new HeaderValue("text/html")],
                ["X-Custom", new HeaderValue("value")],
            ]);
            assert.equal(map.containsKey("content-type"), true);
            assert.equal(map.containsKey("Content-Type"), true);
            assert.equal(map.get("CONTENT-TYPE")?.value, "text/html");
            assert.deepEqual(map.getAll("x-custom"), [new HeaderValue("value")]);
        });

        it("constructs from another HeaderMap", () => {
            const base = HeaderMap.from([["foo", "bar"]]);
            const copy = new HeaderMap(base);
            assert.equal(copy.containsKey("foo"), true);
            assert.equal(copy.get("foo")?.value, "bar");
        });

        it("get returns null for missing key", () => {
            const map = new HeaderMap();
            assert.equal(map.get("missing"), null);
        });

        it("keys returns all keys", () => {
            const map = HeaderMap.from([
                ["a", new HeaderValue("1")],
                ["b", "2"],
            ]);
            const keys = Array.from(map.keys());
            assert.deepEqual(keys.sort(), ["a", "b"]);
        });

        it("values yields all values", () => {
            const map = HeaderMap.from([
                ["a", "1"],
                ["a", "2"],
                ["b", "3"],
            ]);
            const values = Array.from(map.values()).map((v) => v.value);
            assert.deepEqual(values.sort(), ["1", "2", "3"]);
        });

        it("entries yields all key-value pairs", () => {
            const map = HeaderMap.from([
                ["a", "1"],
                ["a", "2"],
                ["b", "3"],
            ]);
            const entries = Array.from(map.entries()).map(([k, v]) => [k, v.value]);
            assert.deepEqual(entries.sort(), [
                ["a", "1"],
                ["a", "2"],
                ["b", "3"],
            ]);
        });

        it("iterable yields same as entries", () => {
            const map = HeaderMap.from([["a", "1"]]);
            const iterated = Array.from(map);
            const entries = Array.from(map.entries());
            assert.deepEqual(iterated, entries);
        });

        it("insert replaces existing values", () => {
            const map = new HeaderMap();
            map.insert("foo", new HeaderValue("bar"));
            assert.deepEqual(map.getAll("foo"), [new HeaderValue("bar")]);
            map.insert("foo", "baz");
            assert.deepEqual(map.getAll("foo"), [new HeaderValue("baz")]);
        });

        it("append adds value to existing key", () => {
            const map = new HeaderMap();
            map.append("foo", new HeaderValue("bar"));
            map.append("foo", "baz");
            assert.deepEqual(map.getAll("foo"), [new HeaderValue("bar"), new HeaderValue("baz")]);
        });

        it("append creates new key if missing", () => {
            const map = new HeaderMap();
            map.append("new", "value");
            assert.deepEqual(map.getAll("new"), [new HeaderValue("value")]);
        });

        it("remove deletes the key and returns first value", () => {
            const map = new HeaderMap();
            map.insert("foo", "bar");
            map.append("foo", "baz");
            const removed = map.remove("foo");
            assert.equal(removed?.value, "bar");
            assert.equal(map.containsKey("foo"), false);
        });

        it("remove returns null for missing key", () => {
            const map = new HeaderMap();
            assert.equal(map.remove("missing"), null);
        });

        it("clear empties the map", () => {
            const map = new HeaderMap();
            map.insert("foo", "bar");
            map.clear();
            assert.equal(map.isEmpty(), true);
        });

        it("extend inserts multiple items replacing existing keys", () => {
            const map = new HeaderMap();
            map.insert("foo", "bar");
            map.extend([
                ["foo", new HeaderValue("baz")],
                ["hello", new HeaderValue("world")],
            ]);
            assert.deepEqual(map.getAll("foo"), [new HeaderValue("baz")]);
            assert.deepEqual(map.getAll("hello"), [new HeaderValue("world")]);
        });

        it("toJSON includes all header values", () => {
            const map = HeaderMap.from([
                ["x-a", "1"],
                ["x-b", "2"],
                ["x-b", "3"],
            ]);
            const json = JSON.stringify(map);
            assert.deepEqual(json, '{"x-a":"1","x-b":["2","3"]}');
        });

        it("toJSON omits sensitive values", () => {
            const map = new HeaderMap();
            map.insert("authorization", new HeaderValue("super-secret", true));
            const json = JSON.stringify(map);
            assert.deepEqual(json, "{}");
        });

        it("inspect shows keys and values", () => {
            const map = HeaderMap.from([
                ["x-debug", "true"],
                ["x-foo", "1"],
                ["x-foo", "2"],
            ]);
            const inspected = util.inspect(map);
            assert.equal(inspected, "{ 'x-debug': 'true', 'x-foo': [ '1', '2' ] }");
        });

        it("inspect hides sensitive values", () => {
            const map = new HeaderMap();
            map.insert("authorization", new HeaderValue("super-secret", true));
            const inspected = util.inspect(map);
            assert.equal(inspected, "{ authorization: Sensitive }");
        });
    });

    describe("HeaderValue", () => {
        it("stores provided value", () => {
            const hv = new HeaderValue("application/json");
            assert.equal(hv.value, "application/json");
        });

        it("defaults to non-sensitive", () => {
            const hv = new HeaderValue("token");
            assert.equal(hv.isSensitive(), false);
        });

        it("can be constructed as sensitive", () => {
            const hv = new HeaderValue("secret", true);
            assert.equal(hv.isSensitive(), true);
        });

        it("setSensitive marks value as sensitive and is chainable", () => {
            const hv = new HeaderValue("secret");
            const returned = hv.setSensitive(true);
            assert.equal(hv.isSensitive(), true);
            assert.strictEqual(returned, hv);
        });

        it("setSensitive(false) unmarks sensitivity", () => {
            const hv = new HeaderValue("secret", true);
            hv.setSensitive(false);
            assert.equal(hv.isSensitive(), false);
        });

        it("toJSON returns placeholder when sensitive", () => {
            const hv = new HeaderValue("super-secret", true);
            assert.equal(hv.toJSON(), "Sensitive");
        });

        it("toJSON returns formatted value when not sensitive", () => {
            const hv = new HeaderValue("plain-value");
            assert.equal(hv.toJSON(), "plain-value");
        });

        it("hides sensitive values from inspect", () => {
            const hv = new HeaderValue("super-secret", true);
            const inspected = util.inspect(hv);
            assert.match(inspected, /Sensitive/);
            assert.doesNotMatch(inspected, /super-secret/);
        });

        it("shows actual value to inspect when not sensitive", () => {
            const hv = new HeaderValue("hello-world");
            const inspected = util.inspect(hv);
            assert.match(inspected, /hello-world/);
        });
    });
});
