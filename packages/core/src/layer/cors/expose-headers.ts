export class ExposeHeaders {
    private readonly inner: string | null;

    private constructor(inner: string | null) {
        this.inner = inner;
    }

    public static default(): ExposeHeaders {
        return ExposeHeaders.none();
    }

    public static none(): ExposeHeaders {
        return new ExposeHeaders(null);
    }

    public static any(): ExposeHeaders {
        return new ExposeHeaders("*");
    }

    public static list(headers: string[]): ExposeHeaders {
        return new ExposeHeaders(headers.join(","));
    }

    public isWildcard(): boolean {
        return this.inner === "*";
    }

    /**
     * @internal
     */
    public toHeader(): [string, string] | null {
        if (!this.inner) {
            return null;
        }

        return ["access-control-expose-headers", this.inner];
    }
}
