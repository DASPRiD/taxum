import type { HttpResponse } from "./response.js";

export const TO_HTTP_RESPONSE = Symbol("toHttpResponse");

/**
 * An interface for objects that can be converted into an HTTP response.
 */
export type ToHttpResponse = {
    [TO_HTTP_RESPONSE](): HttpResponse;
};

/**
 * Determines if a given value implements `ToHttpResponse`.
 */
export const isToHttpResponse = (value: unknown): value is ToHttpResponse => {
    return typeof value === "object" && value !== null && TO_HTTP_RESPONSE in value;
};
