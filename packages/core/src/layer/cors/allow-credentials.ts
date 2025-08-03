import type { Parts } from "../../http/request.js";

export type AllowCredentialsPredicate = (origin: string, parts: Parts) => boolean;

export class AllowCredentials {
    private readonly inner: boolean | AllowCredentialsPredicate;

    private constructor(inner: boolean | AllowCredentialsPredicate) {
        this.inner = inner;
    }

    public static default(): AllowCredentials {
        return AllowCredentials.no();
    }

    public static yes(): AllowCredentials {
        return new AllowCredentials(true);
    }

    public static no(): AllowCredentials {
        return new AllowCredentials(false);
    }

    public static predicate(predicate: AllowCredentialsPredicate): AllowCredentials {
        return new AllowCredentials(predicate);
    }

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
