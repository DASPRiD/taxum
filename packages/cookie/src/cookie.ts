declare const Temporal: {
    Now: {
        zonedDateTimeISO(): TemporalZonedDateTimeLike;
    };
};

/**
 * A Temporal.Instant-compatible object.
 */
type TemporalInstantLike = {
    readonly epochMilliseconds: number;
};

/**
 * A Temporal.ZonedDateTime-compatible object.
 */
type TemporalZonedDateTimeLike = {
    toInstant(): TemporalInstantLike;
};

/**
 * A Temporal.Duration-compatible object.
 */
type TemporalDurationLike = {
    total(totalOf: { unit: "seconds" }): number;
};

export type CookieOptions = {
    expires?: Date | TemporalZonedDateTimeLike | TemporalInstantLike;
    maxAge?: number | TemporalDurationLike;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    partitioned?: boolean;
};

/**
 * Decodes a percent-encoded cookie component.
 *
 * A component that fails to decode (an invalid percent sequence) is returned
 * unchanged rather than throwing, so a single malformed cookie does not fail the
 * whole request. This is more conservative than a per-escape lossy decode: the
 * entire component is left raw when any escape is invalid, not just the bad
 * bytes.
 */
const decodeComponent = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/**
 * Rejects a `Path` or `Domain` attribute value that could break out of the
 * `Set-Cookie` line.
 *
 * These attributes are written verbatim, so a control character or a ";"
 * would allow header or attribute injection. Name and value are safe because
 * they are percent-encoded on {@link Cookie.encode}.
 */
const assertValidAttribute = (field: "path" | "domain", value: string): void => {
    for (const character of value) {
        const code = character.charCodeAt(0);

        if (code <= 0x1f || code === 0x7f || character === ";") {
            throw new TypeError(
                `Cookie ${field} must not contain control characters or a ";" separator`,
            );
        }
    }
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
    public readonly expires: Date | TemporalZonedDateTimeLike | TemporalInstantLike | undefined;
    public readonly maxAge: number | TemporalDurationLike | undefined;
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
        if (options?.path !== undefined) {
            assertValidAttribute("path", options.path);
        }

        if (options?.domain !== undefined) {
            assertValidAttribute("domain", options.domain);
        }

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
        const separatorIndex = cookie.indexOf("=");

        if (separatorIndex === -1) {
            return null;
        }

        const name = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();

        if (name.length === 0) {
            return null;
        }

        return new Cookie(decodeComponent(name), decodeComponent(value));
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
            sameSite: this.sameSite,
            partitioned: this.partitioned,
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
                const totalOf = {
                    unit: "seconds" as const,
                    relativeTo: Temporal.Now.zonedDateTimeISO(),
                };
                parameters.push(`Max-Age=${Math.max(0, Math.floor(this.maxAge.total(totalOf)))}`);
            }
        }

        if (this.expires) {
            if (this.expires instanceof Date) {
                parameters.push(`Expires=${this.expires.toUTCString()}`);
            } else {
                const instant =
                    "toInstant" in this.expires ? this.expires.toInstant() : this.expires;

                parameters.push(`Expires=${new Date(instant.epochMilliseconds).toUTCString()}`);
            }
        }

        return parameters.join("; ");
    }
}
