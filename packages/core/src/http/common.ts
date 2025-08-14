/**
 * Module for unified HTTP request/response handling.
 *
 * This module defines the common building blocks for HTTP requests and
 * responses.
 *
 * @packageDocumentation
 */

import { HttpResponse } from "./response.js";
import { StatusCode } from "./status.js";
import { TO_HTTP_RESPONSE, type ToHttpResponse } from "./to-response.js";

/**
 * An empty response with 204 No Content status.
 */
export const noContentResponse: ToHttpResponse = {
    [TO_HTTP_RESPONSE]: (): HttpResponse => {
        return StatusCode.NO_CONTENT[TO_HTTP_RESPONSE]();
    },
};

/**
 * Represents a type that can be serialized into JSON format.
 *
 * This type encompasses common JSON-compatible values including strings,
 * numbers, booleans, null, arrays of JSON-serializable values, and objects
 * with JSON-serializable properties.
 *
 * Additionally, it includes objects that implement a `toJSON` method to define
 * their custom serialization logic.
 */
export type JsonSerializable =
    | string
    | number
    | boolean
    | null
    | JsonSerializable[]
    | { [key: string]: JsonSerializable | undefined }
    | { toJSON: () => JsonSerializable };

/**
 * A JSON response with the content-type header set to application/json.
 */
export const jsonResponse = (value: JsonSerializable): ToHttpResponse => ({
    [TO_HTTP_RESPONSE]: (): HttpResponse => {
        return HttpResponse.builder()
            .header("content-type", "application/json")
            .body(JSON.stringify(value));
    },
});

/**
 * An HTML response with the content-type header set to text/html.
 */
export const htmlResponse = (html: string): ToHttpResponse => ({
    [TO_HTTP_RESPONSE]: (): HttpResponse => {
        return HttpResponse.builder()
            .header("content-type", "text/html")
            .body(JSON.stringify(html));
    },
});

/**
 * Response that redirects the request to another location.
 *
 * @example
 * ```ts
 * import { Redirect } from "@taxum/core/http";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/old", m.get(() => Redirect.permanent("/new")))
 *     .route("/new", m.get(() => "Hello!"));
 * ```
 */
export class Redirect implements ToHttpResponse {
    private readonly statusCode: StatusCode;
    private readonly uri: URL | string;

    private constructor(statusCode: StatusCode, location: URL | string) {
        this.statusCode = statusCode;
        this.uri = location;
    }

    /**
     * Create a new {@link Redirect} that uses `303 See Other` status code.
     *
     * This redirect instructs the client to change the method to GET for the
     * subsequent request to the given `uri`, which is useful after successful
     * form submission, file upload or when you generally don't want the
     * redirected-to page to observe the original request method and body
     * (if non-empty). If you want to preserve the request method and body,
     * {@link Redirect.temporary} should be used instead.
     *
     * See [MDN: 303 See Other](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303)
     */
    public static to(uri: URL | string): Redirect {
        return new Redirect(StatusCode.SEE_OTHER, uri);
    }

    /**
     * Create a new {@link Redirect} that uses `307 Temporary Redirect` status
     * code.
     *
     * This has the same behavior as {@link Redirect.to}, except it will
     * preserve the original HTTP method and body.
     *
     * See [MDN: 307 Temporary Redirect](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307)
     */
    public static temporary(uri: URL | string): Redirect {
        return new Redirect(StatusCode.TEMPORARY_REDIRECT, uri);
    }

    /**
     * Create a new {@link Redirect} that uses `308 Permanent Redirect` status
     * code.
     *
     * See [MDN: 308 Permanent Redirect](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308)
     */
    public static permanent(uri: URL | string): Redirect {
        return new Redirect(StatusCode.PERMANENT_REDIRECT, uri);
    }

    public [TO_HTTP_RESPONSE](): HttpResponse {
        return HttpResponse.builder()
            .status(this.statusCode)
            .header("location", this.uri.toString())
            .body(null);
    }
}
