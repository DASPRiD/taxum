import type { ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { Body, type BodyLike, isBodyLike } from "./body.js";
import { type ExtensionKey, Extensions } from "./extensions.js";
import { type HeaderEntryLike, HeaderMap } from "./headers.js";
import { StatusCode } from "./status.js";
import { isToHttpResponse, TO_HTTP_RESPONSE, type ToHttpResponse } from "./to-response.js";
import {
    HttpResponseParts,
    isToHttpResponseParts,
    TO_HTTP_RESPONSE_PARTS,
    type ToHttpResponseParts,
} from "./to-response-parts.js";

/**
 * Represents an HTTP response.
 *
 * See {@link http | Ownership and Reuse Contract} in the module documentation.
 */
export class HttpResponse {
    public status: StatusCode;
    public headers: HeaderMap;
    public body: Body;
    public extensions: Extensions;

    /**
     * Creates a new {@link HttpResponse}.
     */
    public constructor(
        status: StatusCode,
        headers: HeaderMap,
        body: Body,
        extensions?: Extensions,
    ) {
        this.status = status;
        this.headers = headers;
        this.body = body;
        this.extensions = extensions ?? new Extensions();
    }

    /**
     * Creates a new {@link HttpResponse} from a {@link HttpResponseLike} value.
     */
    public static from(response: HttpResponseLike): HttpResponse {
        if (isHttpResponseLikePart(response)) {
            return responseLikePartToResponse(response);
        }

        if (response.length === 1) {
            return responseLikePartToResponse(response[0] as HttpResponseLikePart);
        }

        const leading = response.slice(0, -1);
        const res = responseLikePartToResponse(response.at(-1) as HttpResponseLikePart);

        if (leading[0] instanceof HttpResponse) {
            const [first, ...rest] = leading as [HttpResponse, ...ToHttpResponsePartsLike[]];
            HttpResponse.extendFromParts(rest, res);
            res.status = first.status;
            res.headers.extend(first.headers);
            res.extensions.extend(first.extensions);
            return res;
        }

        if (leading[0] instanceof StatusCode) {
            const [first, ...rest] = leading as [StatusCode, ...ToHttpResponsePartsLike[]];
            HttpResponse.extendFromParts(rest, res);
            res.status = first;
            return res;
        }

        if (typeof leading[0] === "number") {
            const [first, ...rest] = leading as [number, ...ToHttpResponsePartsLike[]];
            HttpResponse.extendFromParts(rest, res);
            res.status = StatusCode.fromCode(first);
            return res;
        }

        HttpResponse.extendFromParts(leading as ToHttpResponsePartsLike[], res);
        return res;
    }

    private static extendFromParts(parts: ToHttpResponsePartsLike[], res: HttpResponse): void {
        const responseParts = new HttpResponseParts(res);

        for (const part of parts) {
            const toResponseParts = isToHttpResponseParts(part) ? part : HeaderMap.from(part);
            toResponseParts[TO_HTTP_RESPONSE_PARTS](responseParts);
        }
    }

    /**
     * Creates a new {@link HttpResponseBuilder}.
     */
    public static builder(): HttpResponseBuilder {
        return new HttpResponseBuilder();
    }

    /**
     * Writes the response data, including headers and body, to the provided
     * {@link ServerResponse}.
     */
    public async write(res: ServerResponse): Promise<void> {
        for (const [key, value] of this.headers.entries()) {
            res.appendHeader(key, value.value);
        }

        res.writeHead(this.status.code, this.status.phrase);

        const stream = Readable.fromWeb(this.body.readable);

        return new Promise<void>((resolve, reject) => {
            stream.pipe(res);

            res.on("finish", resolve);
            res.on("error", reject);
            stream.on("error", reject);
        });
    }
}

/**
 * Builder for creating HTTP responses.
 */
export class HttpResponseBuilder {
    private status_ = StatusCode.OK;
    private headers_ = new HeaderMap();
    private extensions_ = new Extensions();

    public status(status: StatusCode | number): this {
        if (status instanceof StatusCode) {
            this.status_ = status;
        } else {
            this.status_ = StatusCode.fromCode(status);
        }

        return this;
    }

    public headers(headers: HeaderMap): this {
        this.headers_.extend(headers);
        return this;
    }

    public header(key: string, value: string): this {
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

    public body(body: BodyLike): HttpResponse {
        return new HttpResponse(this.status_, this.headers_, Body.from(body), this.extensions_);
    }
}

/**
 * Represents a type that can be used as a response in HTTP operations.
 *
 * This type can be one of the following:
 *
 * - {@link HttpResponse}: Represents a standard HTTP response with headers,
 *   status, and body.
 * - {@link ToHttpResponse}: Represents an object or function that can be
 *   transformed into an `HttpResponse`.
 * - {@link BodyLike}: Represents a type that can be interpreted or converted to
 *   the body of an HTTP response.
 *
 * It is used to provide flexibility in handling various forms of HTTP response
 * data.
 */
export type HttpResponseLikePart = HttpResponse | ToHttpResponse | BodyLike | Response;

/**
 * Represents a type that can be used as a response part.
 */
export type ToHttpResponsePartsLike = ToHttpResponseParts | Iterable<HeaderEntryLike>;

/**
 * Represents a value that can be converted into a full {@link HttpResponse}.
 *
 * This type allows for flexible construction of HTTP responses from various
 * forms of input. Possible structures include:
 *
 * 1. A single {@link HttpResponseLikePart}:
 *    - Directly represents a complete response, a response-convertible object,
 *      or a body-like value.
 *
 * 2. An array where the last element is a {@link HttpResponseLikePart} and
 *    preceding elements are {@link ToHttpResponsePartsLike}:
 *    - The last element is converted first into a base response.
 *    - Leading elements are applied from left to right, overriding values
 *      from the previous elements.
 *
 * 3. A tuple starting with a status code ({@link StatusCode} or `number`) or
 *    an {@link HttpResponse}, followed by zero or more
 *    {@link ToHttpResponsePartsLike}, and ending with a
 *    {@link HttpResponseLikePart}:
 *    - The last element is converted first into a base response.
 *    - Middle {@link ToHttpResponsePartsLike} elements are merged in order,
 *      overriding the base response.
 *    - The first element (status code, number, or {@link HttpResponse}) is
 *      applied last, overriding any previous status, headers, or extensions.
 *
 * ## Merging behavior
 *
 * Except for the leading element in tuple forms, later elements override the
 * values of earlier elements. For example, headers and status from later
 * parts replace those from earlier ones.
 */
export type HttpResponseLike =
    | HttpResponseLikePart
    | [...ToHttpResponsePartsLike[], HttpResponseLikePart]
    | [StatusCode | number | HttpResponse, ...ToHttpResponsePartsLike[], HttpResponseLikePart];

const responseLikePartToResponse = (part: HttpResponseLikePart): HttpResponse => {
    if (part instanceof HttpResponse) {
        return part;
    }

    if (part instanceof Response) {
        return new HttpResponse(
            StatusCode.fromCode(part.status),
            HeaderMap.from([...part.headers.entries()]),
            Body.from(part.body),
        );
    }

    if (isToHttpResponse(part)) {
        return part[TO_HTTP_RESPONSE]();
    }

    return Body.from(part)[TO_HTTP_RESPONSE]();
};

const isHttpResponseLikePart = (value: unknown): value is HttpResponseLikePart => {
    return (
        value instanceof HttpResponse ||
        isToHttpResponse(value) ||
        isBodyLike(value) ||
        value instanceof Response
    );
};
