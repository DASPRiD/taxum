import { type CipherKey, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Cookie } from "./cookie.js";
import type { CookieJar } from "./jar.js";

const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * A child cookie jar that provides authenticated encryption for its cookies.
 *
 * A _private_ child jar signs and encrypts all the cookies added to it and
 * verifies and decrypts cookies retrieved from it. Any cookies stored in the
 * `PrivateJar` are simultaneously assured confidentiality, integrity and
 * authenticity. In other words, clients cannot discover nor tamper with the
 * contents of a cookie, nor can they fabricate cookie data.
 */
export class PrivateJar {
    private readonly parent: CookieJar;
    private readonly key: CipherKey;

    /**
     * @internal
     */
    public constructor(parent: CookieJar, key: CipherKey) {
        this.parent = parent;
        this.key = key;
    }

    /**
     * Returns a {@link Cookie} with the name `name` from the parent jar.
     *
     * It authenticates and decrypts the cookie's value, returning a `Cookie`
     * with the decrypted value. If the cookie cannot be found, or the cookie
     * fails to authenticate or decrypt, `null` is returned.
     *
     * @see {@link CookieJar.get}
     */
    public get(name: string): Cookie | null {
        const cookie = this.parent.get(name);
        return cookie ? this.decrypt(cookie) : null;
    }

    /**
     * Adds a {@link Cookie} to the parent jar.
     *
     * The cookie's value is encrypted with authenticated encryption assuring
     * confidentially, integrity and authenticity.
     *
     * @see {@link CookieJar.add}
     */
    public add(cookie: Cookie): void {
        this.parent.add(this.encrypt(cookie));
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

    private encrypt(cookie: Cookie): Cookie {
        const iv = randomBytes(IV_LEN);
        const cipher = createCipheriv("aes-256-gcm", this.key, iv);
        cipher.setAAD(Buffer.from(cookie.name, "utf8"));

        const encrypted = Buffer.concat([cipher.update(cookie.value, "utf8"), cipher.final()]);

        const data: Buffer[] = [iv, encrypted, cipher.getAuthTag()];
        return cookie.withValue(Buffer.concat(data).toString("base64"));
    }

    private decrypt(cookie: Cookie): Cookie | null {
        const data = Buffer.from(cookie.value, "base64");

        if (data.length < IV_LEN + TAG_LEN) {
            return null;
        }

        const iv = data.subarray(0, IV_LEN);
        const cipherText = data.subarray(IV_LEN, data.length - TAG_LEN);
        const tag = data.subarray(data.length - TAG_LEN);

        const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
        decipher.setAAD(Buffer.from(cookie.name, "utf8"));
        decipher.setAuthTag(tag);

        try {
            const decrypted = Buffer.concat([
                decipher.update(cipherText),
                decipher.final(),
            ]).toString("utf8");

            return cookie.withValue(decrypted);
        } catch {
            return null;
        }
    }
}
