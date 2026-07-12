import { parseSetCookie } from "set-cookie-parser";

/**
 * A cookie stored in a {@link TestCookieJar}.
 *
 * Mirrors the attributes of the `set-cookie` header the cookie was ingested
 * from, so tests can assert on them directly.
 */
export type JarCookie = {
    name: string;
    /**
     * The raw cookie value, exactly as the server sent it (no decoding).
     */
    value: string;
    /**
     * The cookie's path; defaults to the RFC 6265 default-path of the
     * request that received it, or `/` for manually seeded cookies.
     */
    path: string;
    /**
     * Whether the cookie carried the `Secure` attribute; `false` when
     * absent, so both assertion directions compare cleanly.
     */
    secure: boolean;
    /**
     * Whether the cookie carried the `HttpOnly` attribute; `false` when
     * absent. Informational only: the jar sends `HttpOnly` cookies like any
     * other, as it is not a browser-script context.
     */
    httpOnly: boolean;
    expires?: Date;
    maxAge?: number;
    domain?: string;
    sameSite?: string;
};

/**
 * Input accepted by {@link TestCookieJar.set}'s object form: a
 * {@link JarCookie} whose `path` (default `/`), `secure`, and `httpOnly`
 * (default `false`) may be omitted.
 */
export type SeedCookie = Omit<JarCookie, "path" | "secure" | "httpOnly"> & {
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
};

type StoredCookie = {
    cookie: JarCookie;
    /**
     * Absolute expiry timestamp resolved at ingest time (`max-age` wins over
     * `expires`, per RFC 6265); `null` for session cookies.
     */
    expiresAt: number | null;
};

/**
 * A client-side cookie jar for a {@link TestClient}.
 *
 * Stores cookies from `set-cookie` response headers (when the client's
 * `saveCookies` option is enabled) and decides which of them accompany each
 * request. `Path`, `Expires`, and `Max-Age` are honored. `Secure` cookies
 * are only sent when the client's base URI uses `https` — with the default
 * `http://localhost/` base URI they are stored but withheld. `Domain` is
 * ignored (the client only ever talks to one host) and so is `HttpOnly`
 * (the jar is not a browser-script context).
 *
 * The jar can be seeded and inspected directly, independently of
 * `saveCookies`, which only gates automatic capture:
 *
 * ```ts
 * client.cookies.set("session", sessionValue);
 * assert.equal(client.cookies.get("session")?.value, sessionValue);
 * ```
 *
 * Cookies are keyed by name and path, mirroring how user agents replace
 * cookies. Values are stored and sent verbatim; no percent-decoding or
 * -encoding is applied.
 */
export class TestCookieJar {
    private readonly cookies = new Map<string, StoredCookie>();

    /**
     * Stores a cookie.
     *
     * The shorthand form seeds a session cookie with path `/`; the object
     * form allows setting attributes.
     */
    public set(name: string, value: string): void;
    public set(cookie: SeedCookie): void;
    public set(cookieOrName: string | SeedCookie, value?: string): void {
        const seed: SeedCookie =
            typeof cookieOrName === "string"
                ? { name: cookieOrName, value: value ?? "" }
                : cookieOrName;

        this.store({
            ...seed,
            path: seed.path ?? "/",
            secure: seed.secure ?? false,
            httpOnly: seed.httpOnly ?? false,
        });
    }

    /**
     * Returns the live cookie with the given name, or `null`.
     *
     * When the same name exists at multiple paths, the cookie with the
     * longest (most specific) path is returned.
     */
    public get(name: string): JarCookie | null {
        this.purgeExpired();

        let bestMatch: JarCookie | null = null;

        for (const { cookie } of this.cookies.values()) {
            if (
                cookie.name === name &&
                (bestMatch === null || cookie.path.length > bestMatch.path.length)
            ) {
                bestMatch = cookie;
            }
        }

        return bestMatch;
    }

    /**
     * Removes all cookies with the given name, across all paths.
     */
    public delete(name: string): void {
        for (const [key, { cookie }] of this.cookies.entries()) {
            if (cookie.name === name) {
                this.cookies.delete(key);
            }
        }
    }

    /**
     * Removes all cookies.
     */
    public clear(): void {
        this.cookies.clear();
    }

    /**
     * Iterates over all live cookies.
     */
    public *[Symbol.iterator](): IterableIterator<JarCookie> {
        this.purgeExpired();

        for (const { cookie } of this.cookies.values()) {
            yield cookie;
        }
    }

    /**
     * Stores a cookie from a raw `set-cookie` header, as if it had been
     * received in a response to a request for `requestUri`.
     *
     * Used by the client to capture response cookies; call it directly to
     * seed the jar from a captured header string. An already-expired cookie
     * (e.g. `Max-Age=0`) removes the matching stored cookie, mirroring how
     * servers delete cookies. Malformed headers are ignored.
     */
    public ingest(setCookieHeader: string, requestUri: URL): void {
        const parsed = parseSetCookie(setCookieHeader, { decodeValues: false, split: false })[0];

        if (!parsed || parsed.name === "") {
            return;
        }

        this.store({
            name: parsed.name,
            value: parsed.value,
            path: resolvePath(parsed.path, requestUri),
            secure: parsed.secure ?? false,
            httpOnly: parsed.httpOnly ?? false,
            expires: parsed.expires,
            maxAge: parsed.maxAge,
            domain: parsed.domain,
            sameSite: parsed.sameSite,
        });
    }

    /**
     * Returns the cookies the jar would send with a request to the given
     * URI, longest path first.
     */
    public cookiesFor(requestUri: URL): JarCookie[] {
        this.purgeExpired();

        const matching: JarCookie[] = [];

        for (const { cookie } of this.cookies.values()) {
            if (cookie.secure && requestUri.protocol !== "https:") {
                continue;
            }

            if (pathMatches(cookie.path, requestUri.pathname)) {
                matching.push(cookie);
            }
        }

        return matching.sort((a, b) => b.path.length - a.path.length);
    }

    private store(cookie: JarCookie): void {
        // NUL cannot appear in a parsed cookie name or path, making the key collision-free.
        const key = `${cookie.name}\0${cookie.path}`;
        const expiresAt = resolveExpiry(cookie);

        if (expiresAt !== null && expiresAt <= Date.now()) {
            this.cookies.delete(key);
            return;
        }

        this.cookies.set(key, { cookie, expiresAt });
    }

    private purgeExpired(): void {
        const now = Date.now();

        for (const [key, { expiresAt }] of this.cookies.entries()) {
            if (expiresAt !== null && expiresAt <= now) {
                this.cookies.delete(key);
            }
        }
    }
}

const resolveExpiry = (cookie: JarCookie): number | null => {
    if (cookie.maxAge !== undefined) {
        return Date.now() + cookie.maxAge * 1000;
    }

    if (cookie.expires !== undefined) {
        const timestamp = cookie.expires.getTime();

        // A malformed Expires parses to an Invalid Date; RFC 6265 says to
        // ignore the attribute, making it a session cookie.
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    return null;
};

/**
 * RFC 6265 §5.2.4: an empty `Path` or one not starting with `/` falls back
 * to the request's default-path.
 */
const resolvePath = (cookiePath: string | undefined, requestUri: URL): string => {
    if (cookiePath?.startsWith("/")) {
        return cookiePath;
    }

    return defaultPath(requestUri);
};

/**
 * RFC 6265 §5.1.4 default-path: the request path's directory.
 */
const defaultPath = (requestUri: URL): string => {
    const path = requestUri.pathname;

    if (path === "" || !path.startsWith("/")) {
        return "/";
    }

    const lastSlash = path.lastIndexOf("/");
    return lastSlash === 0 ? "/" : path.slice(0, lastSlash);
};

/**
 * RFC 6265 §5.1.4 path-match.
 */
const pathMatches = (cookiePath: string, requestPath: string): boolean => {
    if (cookiePath === requestPath) {
        return true;
    }

    if (!requestPath.startsWith(cookiePath)) {
        return false;
    }

    return cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/";
};
