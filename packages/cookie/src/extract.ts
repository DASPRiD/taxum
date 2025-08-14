import type { Extractor } from "@taxum/core/extract";
import type { HttpRequest } from "@taxum/core/http";
import { CookieJar } from "./jar.js";

/**
 * Extractor that grabs cookies from the request and returns a
 * {@link CookieJar}.
 *
 * When making modifications to the cookie jar, you need to return the jar
 * in the response. Any modified or removed cookies will yield a `Set-Cookie`
 * header in the response.
 *
 * @example
 * ```ts
 * import { cookieJar, Cookie } from "@taxum/cookie";
 * import { extractHandler } from "@taxum/core/routing";
 *
 * const handler = extractHandler(cookieJar, (jar) => {
 *     jar.add(new Cookie("foo", "bar"));
 *
 *     return [jar, ""];
 * });
 * ```
 */
export const cookieJar: Extractor<CookieJar> = (req: HttpRequest): CookieJar => {
    return CookieJar.fromHeaders(req.headers);
};
