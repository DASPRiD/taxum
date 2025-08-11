import { Method } from "../../http/index.js";
import type { Parts } from "../../http/request.js";
import { ANY, MIRROR_REQUEST } from "./support.js";

/**
 * Holds configuration for how to set the `Access-Control-Allow-Methods` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods)
 * @see {@link CorsLayer.allowMethods}
 */
export class AllowMethods {
    private readonly inner: string | typeof MIRROR_REQUEST | null;

    private constructor(inner: string | typeof MIRROR_REQUEST | null) {
        this.inner = inner;
    }

    public static default(): AllowMethods {
        return AllowMethods.none();
    }

    public static from(like: AllowMethodsLike): AllowMethods {
        if (like instanceof AllowMethods) {
            return like;
        }

        if (like === ANY) {
            return AllowMethods.any();
        }

        if (like === MIRROR_REQUEST) {
            return AllowMethods.mirrorRequest();
        }

        if (like === null) {
            return AllowMethods.none();
        }

        if (like instanceof Method || typeof like === "string") {
            return AllowMethods.exact(like);
        }

        return AllowMethods.list(like);
    }

    /**
     * Allows no methods.
     */
    public static none(): AllowMethods {
        return new AllowMethods(null);
    }

    /**
     * Allows any methods by sending a wildcard (`*`).
     */
    public static any(): AllowMethods {
        return new AllowMethods("*");
    }

    /**
     * Sets a single allowed method.
     */
    public static exact(method: string | Method): AllowMethods {
        return new AllowMethods(method instanceof Method ? method.toValue() : method);
    }

    /**
     * Sets multiple allowed methods.
     */
    public static list(methods: (string | Method)[]): AllowMethods {
        return new AllowMethods(
            methods.map((m) => (m instanceof Method ? m.toValue() : m)).join(","),
        );
    }

    /**
     * Allow any methods by mirroring the preflight `Access-Control-Request-Method` header.
     */
    public static mirrorRequest(): AllowMethods {
        return new AllowMethods(MIRROR_REQUEST);
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
        let allowMethods: string | null;

        if (this.inner === MIRROR_REQUEST) {
            allowMethods = parts.headers.get("access-control-request-method");
        } else {
            allowMethods = this.inner;
        }

        return allowMethods ? ["access-control-allow-methods", allowMethods] : null;
    }
}

export type AllowMethodsLike =
    | AllowMethods
    | Method
    | string
    | (string | Method)[]
    | typeof ANY
    | typeof MIRROR_REQUEST
    | null;
