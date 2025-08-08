import type { ServerResponse } from "node:http";
import { Body, type BodyLike, isBodyLike } from "./body.js";
import { Extensions } from "./extensions.js";
import { HeaderMap } from "./headers.js";
import { StatusCode } from "./status.js";

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
     * Creates a new immutable `HttpResponse` instance from the given
     * {@link HttpResponseLike} object.
     */
    public static from(response: HttpResponseLike): HttpResponse {
        if (isHttpResponseLikePart(response)) {
            return responseLikePartToResponse(response);
        }

        let result: HttpResponse;
        let headers: HeaderMap;
        let extensions: Extensions;

        if (response.length === 3) {
            result = responseLikePartToResponse(response[2]);
            headers = result.headers;
            headers.extend(response[1]);
            extensions = result.extensions;
        } else {
            result = responseLikePartToResponse(response[1]);
            headers = result.headers;
            extensions = result.extensions;
        }

        if (response[0] instanceof StatusCode) {
            result.status = response[0];
            result.headers = headers;
            return result;
        }

        if (typeof response[0] === "number") {
            result.status = StatusCode.fromCode(response[0]);
            result.headers = headers;
            return result;
        }

        headers.extend(response[0].headers);
        extensions = extensions.extend(response[0].extensions);

        return new HttpResponse(response[0].status, headers, result.body, extensions);
    }

    /**
     * Creates and returns a new instance of the HttpResponseBuilder.
     */
    public static builder(): HttpResponseBuilder {
        return new HttpResponseBuilder();
    }

    /**
     * Writes the response data, including headers and body, to the provided
     * `ServerResponse`.
     */
    public async write(res: ServerResponse): Promise<void> {
        res.writeHead(
            this.status.code,
            this.status.phrase,
            Object.fromEntries(this.headers.entries()),
        );

        const readable = this.body.read();

        return new Promise<void>((resolve, reject) => {
            readable.pipe(res);

            res.on("finish", resolve);
            res.on("error", reject);
            readable.on("error", reject);
        });
    }
}

/**
 * Builder for creating HTTP responses.
 */
export class HttpResponseBuilder {
    private status_ = StatusCode.OK;
    private headers_ = new HeaderMap();

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

    public body(body: BodyLike): HttpResponse {
        return new HttpResponse(this.status_, this.headers_, Body.from(body));
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
export type HttpResponseLikePart = HttpResponse | ToHttpResponse | BodyLike;

/**
 * Represents HTTP headers for a request or response.
 *
 * This type can be either a {@link HeaderMap} or an array of string tuples
 * representing key-value pairs.
 */
export type HttpHeadersPart = HeaderMap | [string, string][];

/**
 * Represents a type that denotes different forms of an HTTP response-like
 * object.
 *
 * Possible variations:
 *
 * - A single {@link HttpResponseLikePart}.
 * - A tuple with a status code {@link StatusCode} and an
 *   {@link HttpResponseLikePart}.
 * - A tuple with a numeric status code and an {@link HttpResponseLikePart}.
 * - A tuple with an {@link HttpResponse} object and an
 *   {@link HttpResponseLikePart}.
 * - A tuple with a status code {@link StatusCode}, HTTP headers
 *   ({@link HttpHeadersPart}), and an {@link HttpResponseLikePart}.
 * - A tuple with a numeric status code, HTTP headers ({@link HttpHeadersPart}),
 *   and an {@link HttpResponseLikePart}.
 * - A tuple with an {@link HttpResponse} object, HTTP headers
 *   ({@link HttpHeadersPart}), and an {@link HttpResponseLikePart}.
 *
 * When the individual elements are merged, the left-most parts take priority
 * over any to their right. This means that parts further on the left override
 * the status code and individual headers which might have been set by parts
 * to their right.
 */
export type HttpResponseLike =
    | HttpResponseLikePart
    | [StatusCode, HttpResponseLikePart]
    | [number, HttpResponseLikePart]
    | [HttpResponse, HttpResponseLikePart]
    | [StatusCode, HttpHeadersPart, HttpResponseLikePart]
    | [number, HttpHeadersPart, HttpResponseLikePart]
    | [HttpResponse, HttpHeadersPart, HttpResponseLikePart];

/**
 * An interface for objects that can be converted into an HTTP response.
 */
export type ToHttpResponse = {
    toHttpResponse(): HttpResponse;
};

/**
 * Determines if a given value implements `ToHttpResponse`.
 */
export const isToHttpResponse = (value: unknown): value is ToHttpResponse => {
    return (
        typeof value === "object" &&
        value !== null &&
        "toHttpResponse" in value &&
        typeof value.toHttpResponse === "function"
    );
};

const responseLikePartToResponse = (part: HttpResponseLikePart): HttpResponse => {
    if (part instanceof HttpResponse) {
        return new HttpResponse(part.status, part.headers, part.body, part.extensions);
    }

    if (isToHttpResponse(part)) {
        return part.toHttpResponse();
    }

    return Body.from(part).toHttpResponse();
};

const isHttpResponseLikePart = (value: unknown): value is HttpResponseLikePart => {
    return value instanceof HttpResponse || isToHttpResponse(value) || isBodyLike(value);
};
