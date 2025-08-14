import { type BinaryLike, createHmac, type KeyObject } from "node:crypto";
import type { Cookie } from "./cookie.js";
import type { CookieJar } from "./jar.js";

const BASE64_DIGEST_LEN = 44;

/**
 * A child cookie jar that authenticates its cookies.
 *
 * A _signed_ child jar signs all the cookies added to it and verifies cookies
 * retrieved from it. Any cookies stored in the `SignedJar` are provided
 * integrity and authenticity. In other words, clients cannot tamper with the
 * contents of a cookie, nor can they fabricate cookie values, but the data is
 * visible in plaintext.
 */
export class SignedJar {
    private readonly parent: CookieJar;
    private readonly key: BinaryLike | KeyObject;

    /**
     * @internal
     */
    public constructor(parent: CookieJar, key: BinaryLike | KeyObject) {
        this.parent = parent;
        this.key = key;
    }

    /**
     * Returns a {@link Cookie} with the name `name` from the parent jar.
     *
     * It verifies the authenticity and integrity of the cookie's value,
     * returning a `Cookie` with the authenticated value. If the cookie cannot
     * be found, or the cookie fails to verify, `null` is returned.
     *
     * @see {@link CookieJar.get}
     */
    public get(name: string): Cookie | null {
        const cookie = this.parent.get(name);
        return cookie ? this.verify(cookie) : null;
    }

    /**
     * Adds a {@link Cookie} to the parent jar.
     *
     * The cookie's value is signed assuring integrity and authenticity.
     *
     * @see {@link CookieJar.add}
     */
    public add(cookie: Cookie): void {
        this.parent.add(this.sign(cookie));
    }

    /**
     * Removes a {@link Cookie} from the parent jar.
     *
     * For correct removal, the passed in `cookie` must contain the same `path`
     * and `domain` as the cookie that was initially set.
     *
     * @see {@link CookieJar.remove}
     */
    public remove(cookie: Cookie): void {
        this.parent.remove(cookie);
    }

    private sign(cookie: Cookie): Cookie {
        const hmac = createHmac("sha256", this.key);
        hmac.update(cookie.value);
        const signature = hmac.digest("base64");

        return cookie.withValue(`${signature}${cookie.value}`);
    }

    private verify(cookie: Cookie): Cookie | null {
        const value = this.verifyValue(cookie.value);
        return value ? cookie.withValue(value) : null;
    }

    private verifyValue(cookieValue: string): string | null {
        const signature = cookieValue.slice(0, BASE64_DIGEST_LEN);
        const value = cookieValue.slice(BASE64_DIGEST_LEN);
        const digest = Buffer.from(signature, "base64");

        const hmac = createHmac("sha256", this.key);
        hmac.update(value);
        const actualDigest = hmac.digest();

        return digest.equals(actualDigest) ? value : null;
    }
}
