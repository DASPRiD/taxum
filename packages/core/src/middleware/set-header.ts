import { type HeaderMap, HeaderValue, type HttpRequest, type HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

export type WithHeaders = {
    headers: HeaderMap;
};

export type MakeHeaderValue<T extends WithHeaders> =
    | HeaderValue
    | string
    | null
    | ((message: T) => HeaderValue | string | null);

/**
 * A layer that sets a specific HTTP response header.
 *
 * @example
 * ```ts
 * import { SetResponseHeaderLayer } from "@taxum/core/middleware/set-header";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new SetResponseHeaderLayer("Content-Type", "text/plain"));
 * ```
 */
export class SetResponseHeaderLayer implements HttpLayer {
    private readonly mode: InsertHeaderMode;
    private readonly name: string;
    private readonly make: MakeHeaderValue<HttpResponse>;

    private constructor(mode: InsertHeaderMode, name: string, make: MakeHeaderValue<HttpResponse>) {
        this.mode = mode;
        this.name = name;
        this.make = make;
    }

    /**
     * Creates a new {@link SetResponseHeaderLayer}.
     *
     * If a previous value exists for the same header, it is removed and
     * replaced with the new header value.
     */
    public static overriding(
        name: string,
        make: MakeHeaderValue<HttpResponse>,
    ): SetResponseHeaderLayer {
        return new SetResponseHeaderLayer(InsertHeaderMode.OVERRIDE, name, make);
    }

    /**
     * Creates a new {@link SetResponseHeaderLayer}.
     *
     * The new header is always added, preserving any existing values. If
     * previous values exist, the header will have multiple values.
     */
    public static appending(
        name: string,
        make: MakeHeaderValue<HttpResponse>,
    ): SetResponseHeaderLayer {
        return new SetResponseHeaderLayer(InsertHeaderMode.APPEND, name, make);
    }

    /**
     * Creates a new {@link SetResponseHeaderLayer}.
     *
     * If a previous value exists for the header, the new value is not inserted.
     */
    public static ifNotPresent(
        name: string,
        make: MakeHeaderValue<HttpResponse>,
    ): SetResponseHeaderLayer {
        return new SetResponseHeaderLayer(InsertHeaderMode.IF_NOT_PRESENT, name, make);
    }

    public layer(inner: HttpService): HttpService {
        return new SetResponseHeader(inner, this.mode, this.name, this.make);
    }
}

class SetResponseHeader implements HttpService {
    private readonly inner: HttpService;
    private readonly mode: InsertHeaderMode;
    private readonly name: string;
    private readonly make: MakeHeaderValue<HttpResponse>;

    public constructor(
        inner: HttpService,
        mode: InsertHeaderMode,
        name: string,
        make: MakeHeaderValue<HttpResponse>,
    ) {
        this.inner = inner;
        this.mode = mode;
        this.name = name;
        this.make = make;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const res = await this.inner.invoke(req);
        this.mode.apply(this.name, res, this.make);
        return res;
    }
}

/**
 * A layer that sets a specific HTTP request header.
 *
 * @example
 * ```ts
 * import { SetRequestHeaderLayer } from "@taxum/core/middleware/set-header";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new SetRequestHeaderLayer("Content-Type", "text/plain"));
 * ```
 */
export class SetRequestHeaderLayer implements HttpLayer {
    private readonly mode: InsertHeaderMode;
    private readonly name: string;
    private readonly make: MakeHeaderValue<HttpRequest>;

    private constructor(mode: InsertHeaderMode, name: string, make: MakeHeaderValue<HttpRequest>) {
        this.mode = mode;
        this.name = name;
        this.make = make;
    }

    /**
     * Creates a new {@link SetRequestHeaderLayer}.
     *
     * If a previous value exists for the same header, it is removed and
     * replaced with the new header value.
     */
    public static overriding(
        name: string,
        make: MakeHeaderValue<HttpRequest>,
    ): SetRequestHeaderLayer {
        return new SetRequestHeaderLayer(InsertHeaderMode.OVERRIDE, name, make);
    }

    /**
     * Creates a new {@link SetRequestHeaderLayer}.
     *
     * The new header is always added, preserving any existing values. If
     * previous values exist, the header will have multiple values.
     */
    public static appending(
        name: string,
        make: MakeHeaderValue<HttpRequest>,
    ): SetRequestHeaderLayer {
        return new SetRequestHeaderLayer(InsertHeaderMode.APPEND, name, make);
    }

    /**
     * Creates a new {@link SetRequestHeaderLayer}.
     *
     * If a previous value exists for the header, the new value is not inserted.
     */
    public static ifNotPresent(
        name: string,
        make: MakeHeaderValue<HttpRequest>,
    ): SetRequestHeaderLayer {
        return new SetRequestHeaderLayer(InsertHeaderMode.IF_NOT_PRESENT, name, make);
    }

    public layer(inner: HttpService): HttpService {
        return new SetRequestHeader(inner, this.mode, this.name, this.make);
    }
}

class SetRequestHeader implements HttpService {
    private readonly inner: HttpService;
    private readonly mode: InsertHeaderMode;
    private readonly name: string;
    private readonly make: MakeHeaderValue<HttpRequest>;

    public constructor(
        inner: HttpService,
        mode: InsertHeaderMode,
        name: string,
        make: MakeHeaderValue<HttpRequest>,
    ) {
        this.inner = inner;
        this.mode = mode;
        this.name = name;
        this.make = make;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        this.mode.apply(this.name, req, this.make);
        return this.inner.invoke(req);
    }
}

type InsertHeaderModeType = "override" | "append" | "if_not_present";

class InsertHeaderMode {
    public static OVERRIDE = new InsertHeaderMode("override");
    public static APPEND = new InsertHeaderMode("append");
    public static IF_NOT_PRESENT = new InsertHeaderMode("if_not_present");

    private readonly type: InsertHeaderModeType;

    private constructor(type: InsertHeaderModeType) {
        this.type = type;
    }

    public apply<T extends WithHeaders>(
        hederName: string,
        target: T,
        make: MakeHeaderValue<T>,
    ): void {
        switch (this.type) {
            case "override": {
                const value = makeValue(target, make);

                if (value !== null) {
                    target.headers.insert(hederName, value);
                }

                break;
            }

            case "append": {
                const value = makeValue(target, make);

                if (value !== null) {
                    target.headers.append(hederName, value);
                }

                break;
            }

            case "if_not_present": {
                if (target.headers.containsKey(hederName)) {
                    break;
                }

                const value = makeValue(target, make);

                if (value !== null) {
                    target.headers.insert(hederName, value);
                }

                break;
            }
        }
    }
}

const makeValue = <T extends WithHeaders>(
    target: T,
    make: MakeHeaderValue<T>,
): HeaderValue | string | null => {
    if (make === null) {
        return null;
    }

    if (typeof make === "string") {
        return make;
    }

    if (make instanceof HeaderValue) {
        return make.value;
    }

    return make(target);
};
