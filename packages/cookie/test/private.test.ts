import assert from "node:assert/strict";
import { type CipherKey, generateKeySync } from "node:crypto";
import { describe, it } from "node:test";
import { Cookie, CookieJar, PrivateJar } from "../src/index.js";

const makePrivateJar = (): { key: CipherKey; jar: CookieJar; priv: PrivateJar } => {
    const key = generateKeySync("aes", { length: 256 });
    const jar = new CookieJar();
    return { key, jar, priv: new PrivateJar(jar, key) };
};

describe("PrivateJar", () => {
    it("simple behaviour: add, get, remove", () => {
        const { priv, jar } = makePrivateJar();
        const cookie = new Cookie("foo", "secret-value");

        priv.add(cookie);

        const rawValue = jar.get("foo")?.value;
        assert(rawValue);
        assert.notEqual(rawValue, "secret-value");
        assert.doesNotMatch(rawValue, /secret-value/);
        assert.doesNotThrow(() => Buffer.from(rawValue, "base64"));

        const decrypted = priv.get("foo");
        assert.equal(decrypted?.value, "secret-value");

        priv.remove(cookie);
        assert.equal(priv.get("foo"), null);
    });

    it("secure behaviour: ignores too short values", () => {
        const { priv, jar } = makePrivateJar();
        jar.add(new Cookie("secure", "foo"));

        const stored = priv.get("secure");
        assert.equal(stored, null);
    });

    it("secure behaviour: detects tampering in ciphertext", () => {
        const { priv, jar } = makePrivateJar();
        priv.add(new Cookie("secure", "top-secret"));

        const stored = jar.get("secure")?.value;
        assert(stored);
        const tamperedBytes = Buffer.from(stored, "base64");
        tamperedBytes[5] ^= 0xff;
        jar.add(new Cookie("secure", tamperedBytes.toString("base64")));

        assert.equal(priv.get("secure"), null);
        assert.notEqual(jar.get("secure")?.value, "top-secret");
    });

    it("secure behaviour: detects tampering in AAD (name)", () => {
        const { priv, jar } = makePrivateJar();
        priv.add(new Cookie("name1", "confidential"));

        const stored = jar.get("name1")?.value;
        assert(stored);
        jar.remove(new Cookie("name1", ""));
        jar.add(new Cookie("name2", stored));

        assert.equal(priv.get("name2"), null);
    });

    it("roundtrip with known key and ciphertext", () => {
        const key = Buffer.alloc(32, 7);
        const jar = new CookieJar();

        const base64Value = "AAAAAAAAAAAAAAAAFrfW3p8ymyf7KpDYYbThBjOIE7cb";
        jar.add(new Cookie("hello", base64Value));

        const priv = new PrivateJar(jar, key);
        assert.equal(priv.get("hello")?.value, "world");
    });
});
