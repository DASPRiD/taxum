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

    it("returns null for a too-short signature without throwing", () => {
        const { signed, jar } = makeSignedJar();
        jar.add(new Cookie("x", "short"));
        assert.equal(signed.get("x"), null);
    });

    it("verifies a signed cookie with an empty value", () => {
        const { signed } = makeSignedJar();
        signed.add(new Cookie("session", ""));

        const verified = signed.get("session");
        assert.notEqual(verified, null);
        assert.equal(verified?.value, "");
    });

    it("does not verify a signed value moved to a different cookie name", () => {
        const { signed, jar } = makeSignedJar();
        signed.add(new Cookie("a", "value"));

        const signedValue = jar.get("a")?.value;
        assert(signedValue);

        jar.add(new Cookie("b", signedValue));

        assert.equal(signed.get("a")?.value, "value");
        assert.equal(signed.get("b"), null);
    });
});
