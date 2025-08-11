import type { Parts } from "../../http/request.js";

export type DynamicMaxAge = (origin: string, parts: Parts) => number;

/**
 * Holds configuration for how to set the `Access-Control-Max-Age` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age)
 * @see {@link CorsLayer.maxAge}
 */
export class MaxAge {
    private readonly inner: number | DynamicMaxAge | null;

    private constructor(inner: number | DynamicMaxAge | null) {
        this.inner = inner;
    }

    public static default(): MaxAge {
        return MaxAge.none();
    }

    public static from(like: MaxAgeLike): MaxAge {
        if (like instanceof MaxAge) {
            return like;
        }

        if (typeof like === "number") {
            return MaxAge.exact(like);
        }

        if (like === null) {
            return MaxAge.none();
        }

        return MaxAge.dynamic(like);
    }

    /**
     * Disables the `Access-Control-Max-Age` header.
     */
    public static none(): MaxAge {
        return new MaxAge(null);
    }

    /**
     * Sets a fixed `Access-Control-Max-Age` header.
     */
    public static exact(maxAge: number): MaxAge {
        return new MaxAge(maxAge);
    }

    /**
     * Sets a dynamic `Access-Control-Max-Age` header.
     */
    public static dynamic(fn: DynamicMaxAge): MaxAge {
        return new MaxAge(fn);
    }

    /**
     * @internal
     */
    public toHeader(origin: string | null, parts: Parts): [string, string] | null {
        if (!this.inner) {
            return null;
        }

        let maxAge: number | null;

        if (typeof this.inner === "number") {
            maxAge = this.inner;
        } else if (!origin) {
            return null;
        } else {
            maxAge = this.inner(origin, parts);
        }

        return ["access-control-max-age", maxAge.toString()];
    }
}

export type MaxAgeLike = MaxAge | number | DynamicMaxAge | null;
