import type { Parts } from "../../http/request.js";
import { ANY, MIRROR_REQUEST } from "./support.js";

/**
 * Holds configuration for how to set the `Access-Control-Allow-Headers` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers)
 * @see {@link CorsLayer.allowHeaders}
 */
export class AllowHeaders {
    private readonly inner: string | typeof MIRROR_REQUEST | null;

    private constructor(inner: string | typeof MIRROR_REQUEST | null) {
        this.inner = inner;
    }

    public static default(): AllowHeaders {
        return AllowHeaders.none();
    }

    public static from(like: AllowHeadersLike): AllowHeaders {
        if (like instanceof AllowHeaders) {
            return like;
        }

        if (like === ANY) {
            return AllowHeaders.any();
        }

        if (like === MIRROR_REQUEST) {
            return AllowHeaders.mirrorRequest();
        }

        if (like === null) {
            return AllowHeaders.none();
        }

        return AllowHeaders.list(like);
    }

    /**
     * Allows no headers.
     */
    public static none(): AllowHeaders {
        return new AllowHeaders(null);
    }

    /**
     * Allows any headers by sending a wildcard (`*`).
     */
    public static any(): AllowHeaders {
        return new AllowHeaders("*");
    }

    /**
     * Sets multiple allowed headers.
     */
    public static list(headers: string[]): AllowHeaders {
        return new AllowHeaders(headers.join(","));
    }

    /**
     * Allow any headers by mirroring the preflight `Access-Control-Request-Headers` header.
     */
    public static mirrorRequest(): AllowHeaders {
        return new AllowHeaders(MIRROR_REQUEST);
    }

    /**
     * @internal
     */
    public isWildcard(): boolean {
        return this.inner === "*";
    }

    /**
     * @internal
     */
    public toHeader(parts: Parts): [string, string] | null {
        let allowHeaders: string | null;

        if (this.inner === MIRROR_REQUEST) {
            allowHeaders = parts.headers.get("access-control-request-headers");
        } else {
            allowHeaders = this.inner;
        }

        return allowHeaders ? ["access-control-allow-headers", allowHeaders] : null;
    }
}

export type AllowHeadersLike = AllowHeaders | string[] | typeof ANY | typeof MIRROR_REQUEST | null;
