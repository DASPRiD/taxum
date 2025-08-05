import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExtensionKey, Extensions } from "../../src/http/index.js";

describe("http:extension", () => {
    describe("ExtensionKey", () => {
        it("creates unique ExtensionKeys", () => {
            const key1 = new ExtensionKey<string>("key1");
            const key2 = new ExtensionKey<string>("key2");
            assert.notEqual(key1.id, key2.id);
        });

        it("stringifies to the key name", () => {
            const key1 = new ExtensionKey<string>("key");
            const key2 = new ExtensionKey<string>();
            assert.equal(key1.toString(), "ExtensionKey(key)");
            assert.equal(key2.toString(), "ExtensionKey(unknown)");
        });
    });

    it("inserts and retrieves values with type safety", () => {
        type Foo = { foo: string };
        const key = new ExtensionKey<Foo>("fooKey");
        const extensions = new Extensions();

        const value: Foo = { foo: "bar" };
        extensions.insert(key, value);

        const retrieved = extensions.get(key);
        assert.deepEqual(retrieved, value);
    });

    it("returns undefined for missing keys", () => {
        const key = new ExtensionKey<number>("missing");
        const extensions = new Extensions();
        assert.equal(extensions.get(key), undefined);
    });

    it("correctly reports existence of keys", () => {
        const key = new ExtensionKey<number>("exists");
        const extensions = new Extensions();
        assert.equal(extensions.has(key), false);

        extensions.insert(key, 123);
        assert.equal(extensions.has(key), true);
    });

    it("removes keys properly", () => {
        const key = new ExtensionKey<string>("remove");
        const extensions = new Extensions();
        extensions.insert(key, "value");
        assert.equal(extensions.has(key), true);

        extensions.remove(key);
        assert.equal(extensions.has(key), false);
    });

    it("clears all entries", () => {
        const extensions = new Extensions();
        extensions.insert(new ExtensionKey<number>("a"), 1);
        extensions.insert(new ExtensionKey<number>("b"), 2);
        assert.equal(extensions.isEmpty(), false);

        extensions.clear();
        assert.equal(extensions.isEmpty(), true);
        assert.equal(extensions.len(), 0);
    });

    it("reports correct size", () => {
        const extensions = new Extensions();
        assert.equal(extensions.len(), 0);

        extensions.insert(new ExtensionKey<number>("x"), 10);
        extensions.insert(new ExtensionKey<string>("y"), "value");
        assert.equal(extensions.len(), 2);
    });

    it("extends one Extensions instance with another", () => {
        const a = new Extensions();
        const b = new Extensions();

        const key1 = new ExtensionKey<number>("key1");
        const key2 = new ExtensionKey<string>("key2");

        a.insert(key1, 42);
        b.insert(key2, "hello");

        a.extend(b);
        assert.equal(a.len(), 2);
        assert.equal(a.get(key1), 42);
        assert.equal(a.get(key2), "hello");
    });

    it("extend returns this for chaining", () => {
        const a = new Extensions();
        const b = new Extensions();
        const result = a.extend(b);
        assert.strictEqual(result, a);
    });
});
