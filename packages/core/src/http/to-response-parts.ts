import type { Extensions } from "./extensions.js";
import type { HeaderMap } from "./headers.js";
import type { HttpResponse } from "./response.js";

/**
 * Parts of a response.
 *
 * @see {@link ToHttpResponseParts}.
 */
export class HttpResponseParts {
    private readonly res: HttpResponse;

    public constructor(res: HttpResponse) {
        this.res = res;
    }

    public get headers(): HeaderMap {
        return this.res.headers;
    }

    public get extensions(): Extensions {
        return this.res.extensions;
    }
}

export const TO_HTTP_RESPONSE_PARTS = Symbol("toHttpResponseParts");

/**
 * Interface for adding headers and extensions to a response.
 */
export type ToHttpResponseParts = {
    /**
     * Sets parts of the response.
     */
    [TO_HTTP_RESPONSE_PARTS](res: HttpResponseParts): void;
};
