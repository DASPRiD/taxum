import { PREFLIGHT_REQUEST_HEADERS } from "./support.js";

export class Vary {
    private readonly inner: string[];

    private constructor(inner: string[]) {
        this.inner = inner;
    }

    public static default(): Vary {
        return Vary.list(PREFLIGHT_REQUEST_HEADERS);
    }

    public static list(headers: string[]): Vary {
        return new Vary(headers);
    }

    /**
     * @internal
     */
    public toHeader(): [string, string] | null {
        if (this.inner.length === 0) {
            return null;
        }

        return ["vary", this.inner.join(", ")];
    }
}
