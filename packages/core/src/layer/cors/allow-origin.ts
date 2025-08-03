import type { Parts } from "../../http/request.js";

export type AllowOriginPredicate = (origin: string, parts: Parts) => Promise<boolean> | boolean;

export class AllowOrigin {
    private readonly inner: string | string[] | AllowOriginPredicate;

    private constructor(inner: string | string[] | AllowOriginPredicate) {
        this.inner = inner;
    }

    public static default(): AllowOrigin {
        return AllowOrigin.list([]);
    }

    public static any(): AllowOrigin {
        return new AllowOrigin("*");
    }

    public static exact(origin: string): AllowOrigin {
        return new AllowOrigin(origin);
    }

    public static list(origins: string[]): AllowOrigin {
        if (origins.includes("*")) {
            throw new Error(
                "Wildcard origin (`*`) cannot be passed to `AllowOrigin.list`. Use `AllowOrigin.any() instead",
            );
        }

        return new AllowOrigin(origins);
    }

    public static predicate(predicate: AllowOriginPredicate): AllowOrigin {
        return new AllowOrigin(predicate);
    }

    public static mirrorRequest(): AllowOrigin {
        return new AllowOrigin(() => true);
    }

    public isWildcard(): boolean {
        return this.inner === "*";
    }

    /**
     * @internal
     */
    public async toHeader(origin: string | null, parts: Parts): Promise<[string, string] | null> {
        const name = "access-control-allow-methods";

        if (typeof this.inner === "string") {
            return [name, this.inner];
        }

        if (!origin) {
            return null;
        }

        if (typeof this.inner === "function") {
            return (await this.inner(origin, parts)) ? [name, origin] : null;
        }

        return this.inner.includes(origin) ? [name, origin] : null;
    }
}
