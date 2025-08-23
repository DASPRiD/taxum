import { type HeaderEntry, HeaderValue } from "../../http/index.js";
import { PREFLIGHT_REQUEST_HEADERS } from "./support.js";

/**
 * Holds configuration for how to set the `Vary` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary)
 * @see {@link CorsLayer.vary})
 */
export class Vary {
    private readonly inner: string[];

    private constructor(inner: string[]) {
        this.inner = inner;
    }

    public static default(): Vary {
        return Vary.list(PREFLIGHT_REQUEST_HEADERS);
    }

    public static from(like: VaryLike): Vary {
        if (like instanceof Vary) {
            return like;
        }

        return Vary.list(like);
    }

    /**
     * Sets multiple headers to vary on.
     */
    public static list(headers: string[]): Vary {
        return new Vary(headers);
    }

    /**
     * @internal
     */
    public toHeader(): HeaderEntry | null {
        if (this.inner.length === 0) {
            return null;
        }

        return ["vary", new HeaderValue(this.inner.join(", "))];
    }
}

export type VaryLike = Vary | string[];
