import { type HeaderEntry, HeaderValue } from "../../http/index.js";
import type { Parts } from "../../http/request.js";
import { ANY, MIRROR_REQUEST } from "./support.js";

export type AllowOriginPredicate = (origin: string, parts: Parts) => Promise<boolean> | boolean;

/**
 * Holds configuration for how to set the `Access-Control-Allow-Origin` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin)
 * @see {@link CorsLayer.allowOrigin}
 */
export class AllowOrigin {
    private readonly inner: typeof MIRROR_REQUEST | string | string[] | AllowOriginPredicate;

    private constructor(inner: typeof MIRROR_REQUEST | string | string[] | AllowOriginPredicate) {
        this.inner = inner;
    }

    public static default(): AllowOrigin {
        return AllowOrigin.list([]);
    }

    public static from(like: AllowOriginLike): AllowOrigin {
        if (like instanceof AllowOrigin) {
            return like;
        }

        if (like === ANY) {
            return AllowOrigin.any();
        }

        if (like === MIRROR_REQUEST) {
            return AllowOrigin.mirrorRequest();
        }

        if (typeof like === "string") {
            return AllowOrigin.exact(like);
        }

        if (Array.isArray(like)) {
            return AllowOrigin.list(like);
        }

        return AllowOrigin.predicate(like);
    }

    /**
     * Allows any origin by sending a wildcard (`*`).
     */
    public static any(): AllowOrigin {
        return new AllowOrigin("*");
    }

    /**
     * Allows a specific origin.
     */
    public static exact(origin: string): AllowOrigin {
        return new AllowOrigin(origin);
    }

    /**
     * Allows a list of origins.
     *
     * @throws {@link !Error} If the list contains a wildcard (`*`).
     */
    public static list(origins: string[]): AllowOrigin {
        if (origins.includes("*")) {
            throw new Error(
                "Wildcard origin (`*`) cannot be passed to `AllowOrigin.list`. Use `AllowOrigin.any() instead",
            );
        }

        return new AllowOrigin(origins);
    }

    /**
     * Allows a list of origins, based on a given predicate.
     */
    public static predicate(predicate: AllowOriginPredicate): AllowOrigin {
        return new AllowOrigin(predicate);
    }

    /**
     * Allows any origin, based on a given predicate.
     */
    public static mirrorRequest(): AllowOrigin {
        return new AllowOrigin(MIRROR_REQUEST);
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
    public async toHeader(origin: HeaderValue | null, parts: Parts): Promise<HeaderEntry | null> {
        const name = "access-control-allow-origin";

        if (typeof this.inner === "string") {
            return [name, new HeaderValue(this.inner)];
        }

        if (!origin) {
            return null;
        }

        if (this.inner === MIRROR_REQUEST) {
            return [name, origin];
        }

        if (typeof this.inner === "function") {
            return (await this.inner(origin.value, parts)) ? [name, origin] : null;
        }

        return this.inner.includes(origin.value) ? [name, origin] : null;
    }
}

export type AllowOriginLike =
    | AllowOrigin
    | string
    | string[]
    | typeof ANY
    | typeof MIRROR_REQUEST
    | AllowOriginPredicate;
