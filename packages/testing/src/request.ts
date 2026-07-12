import { SocketAddress } from "node:net";
import {
    Body,
    type BodyLike,
    CONNECT_INFO,
    type ExtensionKey,
    Extensions,
    type HeaderEntryLike,
    HeaderMap,
    type HeaderValueLike,
    HttpRequest,
    type HttpResponse,
    Method,
    StatusCode,
} from "@taxum/core/http";
import { DISCONNECT_SIGNAL, SHUTDOWN_SIGNAL } from "@taxum/core/server";
import type { HttpService } from "@taxum/core/service";
import type { TestCookieJar } from "./jar.js";
import { TestResponse } from "./response.js";

/**
 * A single value accepted by {@link TestRequest.query} and
 * {@link TestRequest.form} records.
 */
export type QueryValue = string | number | boolean;

/**
 * Input accepted by {@link TestRequest.form}: a flat record (arrays become
 * repeated keys) or a {@link !URLSearchParams} instance.
 */
export type FormInput = Record<string, QueryValue | QueryValue[]> | URLSearchParams;

/**
 * Input accepted by {@link TestRequest.query}: everything {@link FormInput}
 * allows, plus a raw query string for wire formats the flat encoding cannot
 * express (e.g. nested bracket syntax).
 */
export type QueryInput = FormInput | string;

type TestRequestPromise = {
    readonly [Symbol.toStringTag]: string;
    then<TFulfilled = TestResponse, TRejected = never>(
        onFulfilled?: ((value: TestResponse) => TFulfilled | PromiseLike<TFulfilled>) | null,
        onRejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
    ): Promise<TFulfilled | TRejected>;
    catch<TRejected = never>(
        onRejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
    ): Promise<TestResponse | TRejected>;
    finally(onFinally?: (() => void) | null): Promise<TestResponse>;
};

type TestRequestBodySetters = {
    /**
     * Sets a JSON body, implying a `content-type` of `application/json`.
     */
    json(value: unknown): TestRequest<true>;

    /**
     * Sets a URL-encoded form body, implying a `content-type` of
     * `application/x-www-form-urlencoded`.
     */
    form(input: FormInput): TestRequest<true>;

    /**
     * Sets a raw body.
     *
     * No `content-type` is implied; set one via
     * {@link TestRequest.header} if the handler needs it.
     */
    body(body: BodyLike): TestRequest<true>;
};

/**
 * A pending test request.
 *
 * The request is thenable: awaiting it sends it and yields a
 * {@link TestResponse}. The send happens exactly once; awaiting again yields
 * the same response, and calling any setter after the send throws.
 *
 * `BodySet` tracks whether a body setter has been called: once it flips to
 * `true`, the body setters disappear from the type, so setting two bodies
 * does not type-check.
 */
export type TestRequest<BodySet extends boolean = false> = TestRequestPromise & {
    /**
     * Appends a header to the request.
     *
     * An explicit `content-type` header always wins over the one implied by
     * {@link TestRequest.json} or {@link TestRequest.form}.
     */
    header(key: string, value: HeaderValueLike): TestRequest<BodySet>;

    /**
     * Appends multiple headers to the request.
     */
    headers(headers: HeaderMap | Iterable<HeaderEntryLike>): TestRequest<BodySet>;

    /**
     * Appends query parameters to the request URI.
     *
     * Parameters merge with any query string already present in the path and
     * with previous `query()` calls.
     *
     * All input is normalized through {@link !URLSearchParams}; raw strings
     * are re-encoded, not preserved byte-for-byte.
     */
    query(input: QueryInput): TestRequest<BodySet>;

    /**
     * Adds a cookie to the request's `cookie` header.
     *
     * Sent in addition to any matching jar cookies; a duplicate name is
     * emitted twice (jar first), which RFC 6265 permits.
     */
    cookie(name: string, value: string): TestRequest<BodySet>;

    /**
     * Inserts an extension into the request.
     *
     * Per-request extensions override client-level extensions and the
     * client's built-in defaults ({@link CONNECT_INFO},
     * {@link DISCONNECT_SIGNAL}, {@link SHUTDOWN_SIGNAL}).
     */
    extension<T>(key: ExtensionKey<T>, value: T): TestRequest<BodySet>;

    /**
     * Overrides the {@link CONNECT_INFO} extension for this request.
     */
    clientIp(clientIp: string | SocketAddress): TestRequest<BodySet>;

    /**
     * Overrides the {@link DISCONNECT_SIGNAL} extension for this request.
     *
     * Aborting the supplied signal simulates a client disconnect
     * deterministically, e.g. mid-stream for SSE handlers.
     */
    disconnectSignal(signal: AbortSignal): TestRequest<BodySet>;
    // `unknown` is the intersection identity (`T & unknown` is `T`), adding no members.
} & (BodySet extends true ? unknown : TestRequestBodySetters);

export type ResolvedTestClientOptions = {
    baseUri: URL;
    clientIp: SocketAddress;
    extensions: Extensions;
    cookies: TestCookieJar;
    saveCookies: boolean;
};

export class TestRequestBuilder implements TestRequest {
    public readonly [Symbol.toStringTag] = "TestRequest";

    private readonly service: HttpService;
    private readonly clientOptions: ResolvedTestClientOptions;
    private readonly requestMethod: Method;
    private readonly uri: URL;
    private readonly requestHeaders = new HeaderMap();
    private readonly requestExtensions = new Extensions();
    private readonly cookiePairs: [string, string][] = [];
    private requestBody: Body | null = null;
    private impliedContentType: string | null = null;
    private response: Promise<TestResponse> | null = null;

    public constructor(
        service: HttpService,
        method: Method,
        path: string,
        clientOptions: ResolvedTestClientOptions,
    ) {
        if (!path.startsWith("/") || path.startsWith("//")) {
            throw new Error(`Request path must start with a single "/", got: ${path}`);
        }

        this.service = service;
        this.clientOptions = clientOptions;
        this.requestMethod = method;
        this.uri = new URL(path, clientOptions.baseUri);
        // A URI fragment never reaches a server; production requests cannot carry one.
        this.uri.hash = "";
    }

    public header(key: string, value: HeaderValueLike): this {
        this.assertUnsent();
        this.requestHeaders.append(key, value);
        return this;
    }

    public headers(headers: HeaderMap | Iterable<HeaderEntryLike>): this {
        this.assertUnsent();

        const map = headers instanceof HeaderMap ? headers : HeaderMap.from(headers);

        for (const [name, value] of map) {
            this.requestHeaders.append(name, value);
        }

        return this;
    }

    public query(input: QueryInput): this {
        this.assertUnsent();

        for (const [name, value] of toSearchParams(input)) {
            this.uri.searchParams.append(name, value);
        }

        return this;
    }

    public cookie(name: string, value: string): this {
        this.assertUnsent();
        this.cookiePairs.push([name, value]);
        return this;
    }

    public extension<T>(key: ExtensionKey<T>, value: T): this {
        this.assertUnsent();
        this.requestExtensions.insert(key, value);
        return this;
    }

    public clientIp(clientIp: string | SocketAddress): this {
        this.assertUnsent();
        this.requestExtensions.insert(CONNECT_INFO, toSocketAddress(clientIp));
        return this;
    }

    public disconnectSignal(signal: AbortSignal): this {
        this.assertUnsent();
        this.requestExtensions.insert(DISCONNECT_SIGNAL, signal);
        return this;
    }

    public json(value: unknown): TestRequest<true> {
        const serialized = JSON.stringify(value);

        if (serialized === undefined) {
            throw new Error("Value is not JSON-serializable");
        }

        return this.setBody(Body.from(serialized), "application/json");
    }

    public form(input: FormInput): TestRequest<true> {
        return this.setBody(
            Body.from(toSearchParams(input).toString()),
            "application/x-www-form-urlencoded",
        );
    }

    public body(body: BodyLike): TestRequest<true> {
        return this.setBody(Body.from(body), null);
    }

    // biome-ignore lint/suspicious/noThenProperty: the request is intentionally thenable
    public then<TFulfilled = TestResponse, TRejected = never>(
        onFulfilled?: ((value: TestResponse) => TFulfilled | PromiseLike<TFulfilled>) | null,
        onRejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
    ): Promise<TFulfilled | TRejected> {
        return this.send().then(onFulfilled, onRejected);
    }

    public catch<TRejected = never>(
        onRejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
    ): Promise<TestResponse | TRejected> {
        return this.send().catch(onRejected);
    }

    public finally(onFinally?: (() => void) | null): Promise<TestResponse> {
        return this.send().finally(onFinally);
    }

    private setBody(body: Body, impliedContentType: string | null): TestRequest<true> {
        this.assertUnsent();

        if (this.requestBody !== null) {
            throw new Error("Request body has already been set");
        }

        this.requestBody = body;
        this.impliedContentType = impliedContentType;
        return this;
    }

    private assertUnsent(): void {
        if (this.response !== null) {
            throw new Error("Request has already been sent");
        }
    }

    private send(): Promise<TestResponse> {
        this.response ??= this.dispatch();
        return this.response;
    }

    private async dispatch(): Promise<TestResponse> {
        const headers = new HeaderMap(this.requestHeaders);

        if (!headers.containsKey("host")) {
            headers.insert("host", this.uri.host);
        }

        if (this.impliedContentType !== null && !headers.containsKey("content-type")) {
            headers.insert("content-type", this.impliedContentType);
        }

        if (this.requestBody !== null && !headers.containsKey("content-length")) {
            const exactSize = this.requestBody.sizeHint.exact();

            if (exactSize !== null) {
                headers.insert("content-length", exactSize.toString());
            }
        }

        const cookieValues = [
            ...this.clientOptions.cookies
                .cookiesFor(this.uri)
                .map((cookie) => `${cookie.name}=${cookie.value}`),
            ...headers.getAll("cookie").map((value) => value.value),
            ...this.cookiePairs.map(([name, value]) => `${name}=${value}`),
        ];

        if (cookieValues.length > 0) {
            headers.insert("cookie", cookieValues.join("; "));
        }

        const extensions = new Extensions();
        extensions.insert(CONNECT_INFO, this.clientOptions.clientIp);
        extensions.insert(DISCONNECT_SIGNAL, new AbortController().signal);
        extensions.insert(SHUTDOWN_SIGNAL, new AbortController().signal);
        extensions.extend(this.clientOptions.extensions);
        extensions.extend(this.requestExtensions);

        const request = HttpRequest.builder()
            .method(this.requestMethod)
            .uri(this.uri)
            .headers(headers)
            .extensions(extensions)
            .body(this.requestBody);

        const response = await this.service.invoke(request);

        if (this.clientOptions.saveCookies) {
            for (const setCookie of response.headers.getAll("set-cookie")) {
                this.clientOptions.cookies.ingest(setCookie.value, this.uri);
            }
        }

        normalizeResponse(this.requestMethod, response);
        return TestResponse.from(response);
    }
}

export const toSocketAddress = (input: string | SocketAddress): SocketAddress => {
    if (input instanceof SocketAddress) {
        return input;
    }

    return new SocketAddress({
        address: input,
        family: input.includes(":") ? "ipv6" : "ipv4",
    });
};

const toSearchParams = (input: QueryInput): URLSearchParams => {
    if (input instanceof URLSearchParams) {
        return input;
    }

    if (typeof input === "string") {
        return new URLSearchParams(input);
    }

    const params = new URLSearchParams();

    for (const [name, value] of Object.entries(input)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                params.append(name, item.toString());
            }
        } else {
            params.append(name, value.toString());
        }
    }

    return params;
};

/**
 * Applies the normalization a response undergoes on the wire.
 *
 * The route layer only strips HEAD/1xx/204/304 bodies for top-level matched
 * routes; for 405s, default 404s, and non-Router services, production relies
 * on Node's `ServerResponse` to do it. `invoke()` has no `ServerResponse`,
 * so this pass closes the gap. It is idempotent for responses the route
 * layer already normalized.
 *
 * No `content-length` is added: responses without one go out chunked in
 * production, so inventing the header here would let tests assert framing
 * the wire never carries.
 */
const normalizeResponse = (method: Method, res: HttpResponse): void => {
    if (isBodyless(res.status)) {
        res.headers.remove("content-length");
        res.headers.remove("transfer-encoding");
        discardBody(res);
        return;
    }

    if (method.equals(Method.HEAD)) {
        discardBody(res);
    }
};

const isBodyless = (status: StatusCode): boolean =>
    status.isInformational() ||
    status.code === StatusCode.NO_CONTENT.code ||
    status.code === StatusCode.NOT_MODIFIED.code;

const discardBody = (res: HttpResponse): void => {
    res.body.readable.cancel().catch(() => {
        // Errors from a discarded body are of no interest.
    });

    res.body = Body.from(null);
};
