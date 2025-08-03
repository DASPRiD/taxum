/**
 * Module for unified HTTP request/response handling.
 *
 * This module defines the common building blocks for HTTP requests and
 * responses.
 *
 * @packageDocumentation
 */

import { HttpResponse, type ToHttpResponse } from "./response.js";
import { StatusCode } from "./status.js";

/**
 * An empty response with 204 No Content status.
 */
export const noContentResponse: ToHttpResponse = {
    toHttpResponse: (): HttpResponse => {
        return StatusCode.NO_CONTENT.toHttpResponse();
    },
};

/**
 * A JSON response with the content-type header set to application/json.
 */
export const jsonResponse = (value: unknown): ToHttpResponse => ({
    toHttpResponse: (): HttpResponse => {
        return HttpResponse.builder()
            .header("content-type", "application/json")
            .body(JSON.stringify(value));
    },
});

/**
 * An HTML response with the content-type header set to text/html.
 */
export const htmlResponse = (html: string): ToHttpResponse => ({
    toHttpResponse: (): HttpResponse => {
        return HttpResponse.builder()
            .header("content-type", "text/html")
            .body(JSON.stringify(html));
    },
});
