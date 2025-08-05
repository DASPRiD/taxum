import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeaderMap, ReadonlyHeaderMap } from "../../src/http/index.js";

describe("http:headers", () => {
    describe("ReadonlyHeaderMap", () => {
        it("constructs empty map if no argument", () => {
            const map = new ReadonlyHeaderMap();
            assert.equal(map.isEmpty(), true);
            assert.equal(map.len(), 0);
        });

        it("constructs from Map and lowercases keys", () => {
            const original = new Map([
                ["Content-Type", ["text/html"]],
                ["X-Custom", ["value"]],
            ]);
            const map = new ReadonlyHeaderMap(original);
            assert.equal(map.containsKey("content-type"), true);
            assert.equal(map.containsKey("Content-Type"), true);
            assert.equal(map.get("CONTENT-TYPE"), "text/html");
            assert.deepEqual(map.getAll("x-custom"), ["value"]);
        });

        it("constructs from another ReadonlyHeaderMap", () => {
            const base = new ReadonlyHeaderMap(new Map([["foo", ["bar"]]]));
            const copy = new ReadonlyHeaderMap(base);
            assert.equal(copy.containsKey("foo"), true);
            assert.equal(copy.get("foo"), "bar");
        });

        it("get returns null for missing key", () => {
            const map = new ReadonlyHeaderMap();
            assert.equal(map.get("missing"), null);
        });

        it("get returns null for missing empty values", () => {
            const map = new ReadonlyHeaderMap(new Map([["missing", []]]));
            assert.equal(map.get("missing"), null);
        });

        it("getAll returns empty array for missing key", () => {
            const map = new ReadonlyHeaderMap();
            assert.deepEqual(map.getAll("missing"), []);
        });

        it("keys returns all keys", () => {
            const map = new ReadonlyHeaderMap(
                new Map([
                    ["a", ["1"]],
                    ["b", ["2"]],
                ]),
            );
            const keys = Array.from(map.keys());
            assert.deepEqual(keys.sort(), ["a", "b"]);
        });

        it("values yields all values", () => {
            const map = new ReadonlyHeaderMap(
                new Map([
                    ["a", ["1", "2"]],
                    ["b", ["3"]],
                ]),
            );
            const values = Array.from(map.values());
            assert.deepEqual(values.sort(), ["1", "2", "3"]);
        });

        it("entries yields all key-value pairs", () => {
            const map = new ReadonlyHeaderMap(
                new Map([
                    ["a", ["1", "2"]],
                    ["b", ["3"]],
                ]),
            );
            const entries = Array.from(map.entries());
            assert.deepEqual(entries.sort(), [
                ["a", "1"],
                ["a", "2"],
                ["b", "3"],
            ]);
        });

        it("iterable yields same as entries", () => {
            const map = new ReadonlyHeaderMap(new Map([["a", ["1"]]]));
            const iterated = Array.from(map);
            const entries = Array.from(map.entries());
            assert.deepEqual(iterated, entries);
        });

        it("toOwned returns a new HeaderMap", () => {
            const readonly = new ReadonlyHeaderMap(new Map([["x", ["y"]]]));
            const owned = readonly.toOwned();
            assert.notEqual(readonly, owned);
            assert.equal(owned.get("x"), "y");
        });
    });

    describe("HeaderMap", () => {
        it("insert replaces existing values", () => {
            const map = new HeaderMap();
            map.insert("foo", "bar");
            assert.deepEqual(map.getAll("foo"), ["bar"]);
            map.insert("foo", "baz");
            assert.deepEqual(map.getAll("foo"), ["baz"]);
        });

        it("append adds value to existing key", () => {
            const map = new HeaderMap();
            map.append("foo", "bar");
            map.append("foo", "baz");
            assert.deepEqual(map.getAll("foo"), ["bar", "baz"]);
        });

        it("append creates new key if missing", () => {
            const map = new HeaderMap();
            map.append("new", "value");
            assert.deepEqual(map.getAll("new"), ["value"]);
        });

        it("remove deletes the key and returns first value", () => {
            const map = new HeaderMap();
            map.insert("foo", "bar");
            map.append("foo", "baz");
            const removed = map.remove("foo");
            assert.equal(removed, "bar");
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
                ["foo", "baz"],
                ["hello", "world"],
            ]);
            assert.deepEqual(map.getAll("foo"), ["baz"]);
            assert.deepEqual(map.getAll("hello"), ["world"]);
        });
    });
});
