export type CookieOptions = {
    expires?: Date | Temporal.ZonedDateTime;
    maxAge?: number | Temporal.Duration;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    partitioned?: boolean;
};

/**
 * Represents an HTTP cookie.
 *
 * @example
 * ```ts
 * import { Cookie } from "@taxum/cookie";
 *
 * const cookie = new Cookie("my-cookie", "my-value");
 * ```
 */
export class Cookie {
    public readonly name: string;
    public readonly value: string;
    public readonly expires: Date | Temporal.ZonedDateTime | undefined;
    public readonly maxAge: number | Temporal.Duration | undefined;
    public readonly domain: string | undefined;
    public readonly path: string | undefined;
    public readonly secure: boolean | undefined;
    public readonly httpOnly: boolean | undefined;
    public readonly sameSite: "Strict" | "Lax" | "None" | undefined;
    public readonly partitioned: boolean | undefined;

    /**
     * Creates a new {@link Cookie} with a given name and value.
     *
     * You can additionally supply any of the standard cookie options.
     */
    public constructor(name: string, value = "", options?: CookieOptions) {
        this.name = name;
        this.value = value;
        this.expires = options?.expires;
        this.maxAge = options?.maxAge;
        this.domain = options?.domain;
        this.path = options?.path;
        this.secure = options?.secure;
        this.httpOnly = options?.httpOnly;
        this.sameSite = options?.sameSite;
        this.partitioned = options?.partitioned;
    }

    /**
     * Parses a cookie string into a `Cookie` header.
     */
    public static parse(cookie: string): Cookie | null {
        const nameValue = cookie.split("=", 2);

        if (nameValue.length !== 2) {
            return null;
        }

        const name = nameValue[0].trim();
        const value = nameValue[1].trim();

        if (name.length === 0) {
            return null;
        }

        return new Cookie(decodeURIComponent(name), decodeURIComponent(value));
    }

    /**
     * Converts the cookie to a removal cookie.
     */
    public asRemoval(): Cookie {
        return new Cookie(this.name, "", {
            expires: new Date(0),
            maxAge: 0,
            domain: this.domain,
            path: this.path,
            secure: this.secure,
            httpOnly: this.httpOnly,
            sameSite: this.sameSite,
            partitioned: this.partitioned,
        });
    }

    /**
     * Returns a new cookie with the specified value.
     */
    public withValue(value: string): Cookie {
        return new Cookie(this.name, value, {
            expires: this.expires,
            maxAge: this.maxAge,
            domain: this.domain,
            path: this.path,
            secure: this.secure,
            httpOnly: this.httpOnly,
        });
    }

    /**
     * Encodes the cookie for `Set-Cookie` headers.
     *
     * biome-ignore lint/complexity/noExcessiveCognitiveComplexity: simple enough
     */
    public encode(): string {
        const parameters = [`${encodeURIComponent(this.name)}=${encodeURIComponent(this.value)}`];

        if (this.httpOnly) {
            parameters.push("HttpOnly");
        }

        if (this.sameSite) {
            parameters.push(`SameSite=${this.sameSite}`);
        }

        if (this.partitioned) {
            parameters.push("Partitioned");
        }

        if (
            this.secure ||
            this.partitioned ||
            (this.secure === undefined && this.sameSite === "None")
        ) {
            parameters.push("Secure");
        }

        if (this.path !== undefined) {
            parameters.push(`Path=${this.path}`);
        }

        if (this.domain !== undefined) {
            parameters.push(`Domain=${this.domain}`);
        }

        if (this.maxAge !== undefined) {
            if (typeof this.maxAge === "number") {
                parameters.push(`Max-Age=${Math.max(0, Math.floor(this.maxAge))}`);
            } else {
                parameters.push(
                    `Max-Age=${Math.max(0, this.maxAge.total({ unit: "seconds", relativeTo: Temporal.Now.zonedDateTimeISO() }))}`,
                );
            }
        }

        if (this.expires) {
            if (this.expires instanceof Date) {
                parameters.push(`Expires=${this.expires.toUTCString()}`);
            } else {
                parameters.push(
                    `Expires=${new Date(this.expires.toInstant().epochMilliseconds).toUTCString()}`,
                );
            }
        }

        return parameters.join("; ");
    }
}
