import type { Parts } from "../../http/request.js";

export class AllowHeaders {
    private readonly inner: string | typeof MIRROR_REQUEST | null;

    private constructor(inner: string | typeof MIRROR_REQUEST | null) {
        this.inner = inner;
    }

    public static default(): AllowHeaders {
        return AllowHeaders.none();
    }

    public static none(): AllowHeaders {
        return new AllowHeaders(null);
    }

    public static any(): AllowHeaders {
        return new AllowHeaders("*");
    }

    public static list(headers: string[]): AllowHeaders {
        return new AllowHeaders(headers.join(","));
    }

    public static mirrorRequest(): AllowHeaders {
        return new AllowHeaders(MIRROR_REQUEST);
    }

    public isWildcard(): boolean {
        return this.inner === "*";
    }

    /**
     * @internal
     */
    public toHeader(parts: Parts): [string, string] | null {
        let allowHeaders: string | null = null;

        if (this.inner === MIRROR_REQUEST) {
            allowHeaders = parts.headers.get("access-control-request-headers");
        } else {
            allowHeaders = this.inner;
        }

        return allowHeaders ? ["access-control-allow-headers", allowHeaders] : null;
    }
}

const MIRROR_REQUEST = Symbol("Mirror Request");
