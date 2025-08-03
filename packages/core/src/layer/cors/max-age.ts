import type { Parts } from "../../http/request.js";

export type DynamicMaxAge = (origin: string, parts: Parts) => number;

export class MaxAge {
    private readonly inner: number | DynamicMaxAge | null;

    private constructor(inner: number | DynamicMaxAge | null) {
        this.inner = inner;
    }

    public static default(): MaxAge {
        return MaxAge.none();
    }

    public static none(): MaxAge {
        return new MaxAge(null);
    }

    public static exact(maxAge: number): MaxAge {
        return new MaxAge(maxAge);
    }

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
