import assert from "node:assert/strict";
import { generateKeySync, type KeyObject } from "node:crypto";
import { describe, it } from "node:test";
import { Cookie, CookieJar, SignedJar } from "../src/index.js";

const makeSignedJar = (): { key: KeyObject; jar: CookieJar; signed: SignedJar } => {
    const key = generateKeySync("hmac", { length: 512 });
    const jar = new CookieJar();
    return { key, jar, signed: new SignedJar(jar, key) };
};

describe("signed", () => {
    it("simple behaviour: add, get, remove", () => {
        const { signed, jar } = makeSignedJar();
        const cookie = new Cookie("foo", "bar");

        signed.add(cookie);

        const rawValue = jar.get("foo")?.value;
        assert(rawValue);
        assert.notEqual(rawValue, "bar");
        assert.match(rawValue, /bar$/);

        const verified = signed.get("foo");
        assert.equal(verified?.value, "bar");

        signed.remove(cookie);
        assert.equal(signed.get("foo"), null);
    });

    it("secure behaviour: detects tampering", () => {
        const { signed, jar } = makeSignedJar();
        signed.add(new Cookie("secure", "value"));
        jar.add(new Cookie("secure", "tampered-value"));

        assert.equal(signed.get("secure"), null);
        assert.equal(jar.get("secure")?.value, "tampered-value");
    });

    it("roundtrip with known key and pre-signed values", () => {
        const keyBytes = Uint8Array.from([
            89, 202, 200, 125, 230, 90, 197, 245, 166, 249, 34, 169, 135, 31, 20, 197, 94, 154, 254,
            79, 60, 26, 8, 143, 254, 24, 116, 138, 92, 225, 159, 60, 157, 41, 135, 129, 31, 226,
            196, 16, 198, 168, 134, 4, 42, 1, 196, 24, 57, 103, 241, 147, 201, 185, 233, 10, 180,
            170, 187, 89, 252, 137, 110, 107,
        ]);
        const key = Buffer.from(keyBytes);
        const jar = new CookieJar();

        jar.add(new Cookie("a", "TvVFEniX3o7tcNAi76ZHKG4QQCpLJCnZkc5Oq8J87bY=Tamper-proof"));
        jar.add(new Cookie("b", "TvVFEniX3o7tcNAi76ZHKG4QQCpLJCnZkc5Oq8J87bY=Tamper-proof"));

        const signed = new SignedJar(jar, key);

        assert.equal(signed.get("a")?.value, "Tamper-proof");
        assert.equal(signed.get("b")?.value, "Tamper-proof");
    });
});
