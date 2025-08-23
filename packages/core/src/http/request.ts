import type { IncomingMessage } from "node:http";
import { SocketAddress } from "node:net";
import type util from "node:util";
import { Body, type BodyLike } from "./body.js";
import { type ExtensionKey, Extensions } from "./extensions.js";
import { HeaderMap, type HeaderValueLike } from "./headers.js";
import { Method } from "./method.js";

/**
 * Represents the components of an HTTP request, encapsulating method, URI,
 * version, headers, and optional extensions.
 */
export class Parts {
    public readonly method: Method;
    public readonly uri: URL;
    public readonly version: string;
    public readonly headers: HeaderMap;
    public readonly extensions: Extensions;

    /**
     * Creates a new {@link Parts}.
     */
    public constructor(
        method: Method,
        uri: URL,
        version: string,
        headers: HeaderMap,
        extensions?: Extensions,
    ) {
        this.method = method;
        this.uri = uri;
        this.version = version;
        this.headers = headers;
        this.extensions = extensions ?? new Extensions();
    }

    /**
     * Creates a new {@link Parts} with the provided URI.
     */
    public withUri(uri: URL): Parts {
        return new Parts(this.method, uri, this.version, this.headers, this.extensions);
    }

    /**
     * Creates a new {@link Parts} from the provided {@link IncomingMessage}.
     *
     * If `trustProxy` is `true`, the `X-Forwarded-Proto` and `X-Forwarded-Host`
     * headers will be used to determine the protocol and host of the request.
     *
     * Otherwise, the protocol and host will be determined from the
     * `IncomingMessage`.
     */
    public static fromIncomingMessage(message: IncomingMessage, trustProxy: boolean): Parts {
        const headers = HeaderMap.fromIncomingMessage(message);
        const localProtocol =
            "encrypted" in message.socket && message.socket.encrypted === true ? "https" : "http";

        let protocol: "http" | "https";
        let host: string;

        if (trustProxy) {
            const forwardedProto = headers.get("x-forwarded-proto")?.value;
            const forwardedHost = headers.get("x-forwarded-host")?.value;

            protocol =
                forwardedProto === "https" || forwardedProto === "http"
                    ? forwardedProto
                    : localProtocol;
            host = forwardedHost ?? headers.get("host")?.value ?? "localhost";
        } else {
            protocol = localProtocol;
            host = headers.get("host")?.value ?? "localhost";
        }

        const uri = new URL(`${protocol}://${host}${message.url}`);

        return new Parts(
            Method.fromString(message.method ?? ""),
            uri,
            message.httpVersion,
            headers,
        );
    }
}

/**
 * Represents an HTTP request, encapsulating the request's headers, body, and
 * associated metadata such as the HTTP method, URI, and version.
 */
export class HttpRequest {
    public readonly head: Parts;
    public readonly body: Body;
    public readonly connectInfo: SocketAddress;

    /**
     * Creates a new {@link HttpRequest}.
     */
    public constructor(head: Parts, body: Body, connectInfo?: SocketAddress) {
        this.head = head;
        this.body = body;
        this.connectInfo =
            connectInfo ??
            new SocketAddress({
                address: "0.0.0.0",
                family: "ipv4",
            });
    }

    /**
     * Creates a new {@link HttpRequestBuilder}.
     */
    public static builder(): HttpRequestBuilder {
        return new HttpRequestBuilder();
    }

    /**
     * Creates a new {@link HttpRequest} from the provided {@link IncomingMessage}.
     *
     * @see {@link Parts.fromIncomingMessage} for more information about the `trustProxy`
     *      parameter.
     */
    public static fromIncomingMessage(message: IncomingMessage, trustProxy: boolean): HttpRequest {
        return new HttpRequest(
            Parts.fromIncomingMessage(message, trustProxy),
            Body.from(message),
            new SocketAddress({
                address:
                    message.socket.remoteAddress === "" ? "0.0.0.0" : message.socket.remoteAddress,
                family: message.socket.remoteFamily === "IPv6" ? "ipv6" : "ipv4",
                port: message.socket.remotePort,
            }),
        );
    }

    /**
     * Creates a new {@link HttpRequest} with the provided body.
     */
    public withBody(body: Body): HttpRequest {
        return new HttpRequest(this.head, body, this.connectInfo);
    }

    /**
     * Creates a new {@link HttpRequest} with the provided URI.
     */
    public withUri(uri: URL): HttpRequest {
        return new HttpRequest(this.head.withUri(uri), this.body, this.connectInfo);
    }

    public get method(): Method {
        return this.head.method;
    }

    public get uri(): URL {
        return this.head.uri;
    }

    public get version(): string {
        return this.head.version;
    }

    public get headers(): HeaderMap {
        return this.head.headers;
    }

    public get extensions(): Extensions {
        return this.head.extensions;
    }

    public toJSON(): Record<string, unknown> {
        return {
            method: this.method.toJSON(),
            uri: this.uri.toJSON(),
            version: this.version,
            headers: this.headers.toJSON(),
            extensions: this.extensions.toJSON(),
        };
    }

    [Symbol.for("nodejs.util.inspect.custom")](
        _depth: number,
        options: util.InspectOptionsStylized,
        inspect: typeof util.inspect,
    ): string {
        return inspect(
            {
                method: this.method,
                uri: this.uri.toString(),
                version: this.version,
                headers: this.headers,
                extensions: this.extensions,
            },
            options,
        );
    }
}

/**
 * Builder for creating HTTP requests.
 */
export class HttpRequestBuilder {
    private method_ = Method.GET;
    private uri_ = new URL("http://localhost/");
    private version_ = "1.1";
    private headers_ = new HeaderMap();
    private extensions_ = new Extensions();
    private connectInfo_: SocketAddress | undefined;

    public method(method: Method | string): this {
        this.method_ = typeof method === "string" ? Method.fromString(method) : method;
        return this;
    }

    public uri(uri: URL): this {
        this.uri_ = uri;
        return this;
    }

    public path(path: string): this {
        this.uri_.pathname = path;
        return this;
    }

    public version(version: string): this {
        this.version_ = version;
        return this;
    }

    public headers(headers: HeaderMap): this {
        this.headers_ = headers;
        return this;
    }

    public header(key: string, value: HeaderValueLike): this {
        this.headers_.append(key, value);
        return this;
    }

    public extensions(extensions: Extensions): this {
        this.extensions_ = extensions;
        return this;
    }

    public extension<T>(key: ExtensionKey<T>, value: T): this {
        this.extensions_.insert(key, value);
        return this;
    }

    public connectInfo(connectInfo: SocketAddress): this {
        this.connectInfo_ = connectInfo;
        return this;
    }

    public body(body: BodyLike) {
        return new HttpRequest(
            new Parts(this.method_, this.uri_, this.version_, this.headers_, this.extensions_),
            Body.from(body),
            this.connectInfo_,
        );
    }
}
