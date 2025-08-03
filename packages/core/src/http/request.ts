import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";
import { Extensions } from "./extensions.js";
import { HeaderMap } from "./headers.js";

/**
 * Represents the components of an HTTP request, encapsulating method, URI,
 * version, headers, and optional extensions.
 */
export class Parts {
    public readonly method: string;
    public readonly uri: URL;
    public readonly version: string;
    public readonly headers: HeaderMap;
    public readonly extensions: Extensions;

    public constructor(
        method: string,
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

    public static fromIncomingMessage(message: IncomingMessage, trustProxy: boolean): Parts {
        const headers = HeaderMap.fromIncomingMessage(message);
        const localProtocol =
            "encrypted" in message.socket && message.socket.encrypted === true ? "https" : "http";

        let protocol: "http" | "https";
        let host: string;

        if (trustProxy) {
            const forwardedProto = headers.get("x-forwarded-proto");
            const forwardedHost = headers.get("x-forwarded-host");

            protocol =
                forwardedProto === "https" || forwardedProto === "http"
                    ? forwardedProto
                    : localProtocol;
            host = forwardedHost ?? headers.get("host") ?? "localhost";
        } else {
            protocol = localProtocol;
            host = headers.get("host") ?? "localhost";
        }

        const uri = new URL(`${protocol}://${host}${message.url}`);

        return new Parts(message.method ?? "", uri, message.httpVersion, headers);
    }
}

/**
 * Represents an HTTP request, encapsulating the request's headers, body, and
 * associated metadata such as the HTTP method, URI, and version.
 */
export class HttpRequest {
    public readonly head: Parts;
    public readonly body: Readable;

    public constructor(head: Parts, body: Readable) {
        this.head = head;
        this.body = body;
    }

    public static fromIncomingMessage(message: IncomingMessage, trustProxy: boolean): HttpRequest {
        return new HttpRequest(Parts.fromIncomingMessage(message, trustProxy), message);
    }

    public get method(): string {
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
}
