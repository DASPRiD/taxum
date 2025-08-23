import type { BinaryLike, CipherKey, KeyObject } from "node:crypto";
import {
    type HeaderMap,
    type HttpResponseParts,
    TO_HTTP_RESPONSE_PARTS,
    type ToHttpResponseParts,
} from "@taxum/core/http";
import { Cookie } from "./cookie.js";
import { PrivateJar } from "./private.js";
import { SignedJar } from "./signed.js";

type DeltaCookie = {
    cookie: Cookie;
    removed: boolean;
};

/**
 * A collection of cookies that tracks its modifications.
 *
 * A `CookieJar` provides storage for any number of cookies. Any changes made to
 * the jar are tracked; when serialized to response parts, the modified cookies
 * are added to the response headers.
 *
 * @example
 * ```ts
 * import { Cookie, CookieJar } from "@taxum/cookie";
 *
 * const jar = new CookieJar();
 * jar.add(new Cookie("foo", "bar"));
 * ```
 */
export class CookieJar implements ToHttpResponseParts {
    private originalCookies: Map<string, DeltaCookie>;
    private deltaCookies = new Map<string, DeltaCookie>();

    /**
     * Creates a new {@link CookieJar}.
     *
     * You can optionally provide an array of {@link Cookie}s to initialize the
     * jar with. These cookies must be raw request cookies.
     */
    public constructor(originalCookies?: Cookie[]) {
        this.originalCookies = new Map(
            originalCookies?.map((cookie) => [cookie.name, { cookie, removed: false }]),
        );
    }

    /**
     * Creates a {@link CookieJar} from a {@link HeaderMap}.
     */
    public static fromHeaders(headers: HeaderMap): CookieJar {
        const cookies = headers
            .getAll("cookie")
            .flatMap((value) => value.value.split(";"))
            .map((value) => Cookie.parse(value))
            .filter((cookie): cookie is Cookie => cookie !== null);

        return new CookieJar(cookies);
    }

    /**
     * Returns a {@link SignedJar} with `this` as its parent jar using the key
     * `key` to verify cookies retrieved from the child jar.
     *
     * Any retrievals from the child jar will be made from the parent jar.
     *
     * @example
     * ```ts
     * import { assert } from "node:assert/strict";
     * import { generateKey } from "node:crypto";
     * import { Cookie, CookieJar } from "@taxum/cookie";
     *
     * const jar = new CookieJar();
     *
     * // Generate a secure key.
     * const key = generateKey("hmac", { length: 512 });
     *
     * // Add a signed cookie.
     * jar.signed(key).add(new Cookie("signed", "text"));
     *
     * // The cookie's contents are signed but still plaintext.
     * assert.notEqual(jar.get("signed")?.value, "text");
     * assert.match(jar.get("signed")?.value, /text/);
     *
     * // They can be verified through the child jar.
     * assert.equal(jar.signed(key).get("signed")?.value, "text");
     *
     * // A tampered with cookie does not validate but still exists.
     * jar.add(new Cookie("signed", "tampered"));
     * assert.equal(jar.signed(key).get("signed"), null);
     * assert.equal(jar.get("signed")?.value, "tampered");
     * ```
     */
    public signed(key: BinaryLike | KeyObject): SignedJar {
        return new SignedJar(this, key);
    }

    /**
     * Returns a {@link PrivateJar} with `this` as its parent jar using the key
     * `key` to verify/decrypt cookies from the child jar.
     *
     * Any retrievals from the child jar will be made from the parent jar.
     *
     * @example
     * ```ts
     * import { assert } from "node:assert/strict";
     * import { generateKey } from "node:crypto";
     * import { Cookie, CookieJar } from "@taxum/cookie";
     *
     * const jar = new CookieJar();
     *
     * // Generate a secure key.
     * const key = generateKey("aes", { length: 256 });
     *
     * // Add a private (signed and encrypted) cookie.
     * jar.private(key).add(new Cookie("private", "text"));
     *
     * // The cookie's contents are encrypted.
     * assert.notEqual(jar.get("private")?.value, "text");
     *
     * // They can be decrypted and verified through the child jar.
     * assert.equal(jar.private(key).get("private")?.value, "text");
     *
     * // A tampered with cookie does not validate but still exists.
     * jar.add(new Cookie("private", "tampered"));
     * assert.equal(jar.private(key).get("private"), null);
     * assert.equal(jar.get("private")?.value, "tampered");
     * ```
     */
    public private(key: CipherKey): PrivateJar {
        return new PrivateJar(this, key);
    }

    /**
     * Returns a cookie inside this jar with the name `name`.
     *
     * If the cookie is not found, returns `null`.
     */
    public get(name: string): Cookie | null {
        const deltaCookie = this.deltaCookies.get(name) ?? this.originalCookies.get(name);
        return deltaCookie?.removed === false ? deltaCookie.cookie : null;
    }

    /**
     * Adds a {@link Cookie} to this jar.
     *
     * If a cookie with the same name already exists, it will be replaced.
     */
    public add(cookie: Cookie): void {
        this.deltaCookies.set(cookie.name, { cookie, removed: false });
    }

    /**
     * Removes a {@link Cookie} from this jar.
     *
     * If an _original_ cookie with the same name as `cookie` is present in the
     * jar, a _removal_ cookie will be present in the response. To properly
     * generate a removal cookie, `cookie` must contain the same `path` and
     * `domain` as the cookie that was initially set.
     *
     * A "removal" cookie is a cookie that has the same name as the original
     * cookie but has an empty value, a max-age of 0, and an expiration date far
     * in the past.
     */
    public remove(cookie: Cookie): void {
        if (this.originalCookies.has(cookie.name)) {
            this.deltaCookies.set(cookie.name, { cookie: cookie.asRemoval(), removed: true });
        } else {
            this.deltaCookies.delete(cookie.name);
        }
    }

    /**
     * Returns an iterator over all the cookies present in this jar.
     */
    public *[Symbol.iterator](): IterableIterator<Cookie> {
        const yielded = new Set<string>();

        for (const { cookie } of this.deltaCookies.values()) {
            yielded.add(cookie.name);
            yield cookie;
        }

        for (const { cookie } of this.originalCookies.values()) {
            if (yielded.has(cookie.name)) {
                continue;
            }

            yield cookie;
        }
    }

    [TO_HTTP_RESPONSE_PARTS](res: HttpResponseParts): void {
        const headers = res.headers;

        for (const { cookie } of this.deltaCookies.values()) {
            headers.insert("set-cookie", cookie.encode());
        }
    }
}
