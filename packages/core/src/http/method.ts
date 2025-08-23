import type util from "node:util";

/**
 * Represents an HTTP method.
 *
 * This class defines standard HTTP methods as static readonly properties
 * and provides functionality to create new method instances from strings.
 */
export class Method {
    public static readonly CONNECT = new Method("CONNECT");
    public static readonly DELETE = new Method("DELETE");
    public static readonly GET = new Method("GET");
    public static readonly HEAD = new Method("HEAD");
    public static readonly OPTIONS = new Method("OPTIONS");
    public static readonly PATCH = new Method("PATCH");
    public static readonly POST = new Method("POST");
    public static readonly PUT = new Method("PUT");
    public static readonly TRACE = new Method("TRACE");

    public readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    /**
     * Compares the current method with another method to determine equality.
     */
    public equals(other: Method | string): boolean {
        return this.value === (typeof other === "string" ? other : other.value);
    }

    /**
     * Converts a string representation of an HTTP method to its corresponding
     * `Method` enum or creates a new `Method` object if no match is found.
     *
     * Note that method string representations are case-sensitive!
     */
    public static fromString(method: string): Method {
        switch (method) {
            case "CONNECT":
                return Method.CONNECT;
            case "DELETE":
                return Method.DELETE;
            case "GET":
                return Method.GET;
            case "HEAD":
                return Method.HEAD;
            case "OPTIONS":
                return Method.OPTIONS;
            case "PATCH":
                return Method.PATCH;
            case "POST":
                return Method.POST;
            case "PUT":
                return Method.PUT;
            case "TRACE":
                return Method.TRACE;
        }

        return new Method(method);
    }

    public toJSON(): string {
        return this.value;
    }

    [Symbol.for("nodejs.util.inspect.custom")](
        _depth: number,
        options: util.InspectOptionsStylized,
        inspect: typeof util.inspect,
    ): string {
        return inspect(this.value, options);
    }
}
