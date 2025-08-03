import type { Parts } from "../../http/request.js";

export class AllowMethods {
    private readonly inner: string | typeof MIRROR_REQUEST | null;

    private constructor(inner: string | typeof MIRROR_REQUEST | null) {
        this.inner = inner;
    }

    public static default(): AllowMethods {
        return AllowMethods.none();
    }

    public static none(): AllowMethods {
        return new AllowMethods(null);
    }

    public static any(): AllowMethods {
        return new AllowMethods("*");
    }

    public static exact(method: string): AllowMethods {
        return new AllowMethods(method);
    }

    public static list(methods: string[]): AllowMethods {
        return new AllowMethods(methods.join(","));
    }

    public static mirrorRequest(): AllowMethods {
        return new AllowMethods(MIRROR_REQUEST);
    }

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

const MIRROR_REQUEST = Symbol("Mirror Request");
