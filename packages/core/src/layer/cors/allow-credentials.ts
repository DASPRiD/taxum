import type { Parts } from "../../http/request.js";

export type AllowCredentialsPredicate = (origin: string, parts: Parts) => boolean;

/**
 * Holds configuration for how to set the `Access-Control-Allow-Credentials` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials)
 * @see {@link CorsLayer.allowCredentials}
 */
export class AllowCredentials {
    private readonly inner: boolean | AllowCredentialsPredicate;

    private constructor(inner: boolean | AllowCredentialsPredicate) {
        this.inner = inner;
    }

    public static default(): AllowCredentials {
        return AllowCredentials.no();
    }

    public static from(like: AllowCredentialsLike): AllowCredentials {
        if (like instanceof AllowCredentials) {
            return like;
        }

        if (typeof like === "boolean") {
            return like ? AllowCredentials.yes() : AllowCredentials.no();
        }

        return AllowCredentials.predicate(like);
    }

    /**
     * Allows credentials for all requests.
     */
    public static yes(): AllowCredentials {
        return new AllowCredentials(true);
    }

    /**
     * Allows credentials for no request.
     */
    public static no(): AllowCredentials {
        return new AllowCredentials(false);
    }

    /**
     * Allows credentials for some requests, based on a given predicate.
     */
    public static predicate(predicate: AllowCredentialsPredicate): AllowCredentials {
        return new AllowCredentials(predicate);
    }

    /**
     * @internal
     */
    public isTrue(): boolean {
        return this.inner === true;
    }

    /**
     * @internal
     */
    public toHeader(origin: string | null, parts: Parts): [string, string] | null {
        const allowCredentials =
            typeof this.inner === "boolean"
                ? this.inner
                : origin
                  ? this.inner(origin, parts)
                  : false;

        if (!allowCredentials) {
            return null;
        }

        return ["access-control-allow-credentials", "true"];
    }
}

export type AllowCredentialsLike = AllowCredentials | boolean | AllowCredentialsPredicate;
