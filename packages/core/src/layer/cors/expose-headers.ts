import { ANY } from "./support.js";

/**
 * Holds configuration for how to set the `Access-Control-Expose-Headers` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers)
 * @see {@link CorsLayer.exposeHeaders}
 */
export class ExposeHeaders {
    private readonly inner: string | null;

    private constructor(inner: string | null) {
        this.inner = inner;
    }

    public static default(): ExposeHeaders {
        return ExposeHeaders.none();
    }

    public static from(like: ExposeHeadersLike): ExposeHeaders {
        if (like instanceof ExposeHeaders) {
            return like;
        }

        if (like === ANY) {
            return ExposeHeaders.any();
        }

        if (like === null) {
            return ExposeHeaders.none();
        }

        return ExposeHeaders.list(like);
    }

    /**
     * Allows no headers.
     */
    public static none(): ExposeHeaders {
        return new ExposeHeaders(null);
    }

    /**
     * Allows any headers by sending a wildcard (`*`).
     */
    public static any(): ExposeHeaders {
        return new ExposeHeaders("*");
    }

    /**
     * Sets multiple exposed headers.
     */
    public static list(headers: string[]): ExposeHeaders {
        return new ExposeHeaders(headers.join(","));
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
    public toHeader(): [string, string] | null {
        if (!this.inner) {
            return null;
        }

        return ["access-control-expose-headers", this.inner];
    }
}

export type ExposeHeadersLike = ExposeHeaders | string[] | typeof ANY | null;
