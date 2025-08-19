import {
    HttpResponse,
    type StatusCode,
    TO_HTTP_RESPONSE,
    type ToHttpResponse,
} from "../http/index.js";

/**
 * `ClientError` represents any error thrown due to issues with client requests.
 *
 * This error is generally used by built-in extractors and middleware. You can
 * check for this error in your own error handler to create responses matching
 * your own API error format.
 *
 * `ClientError` is not extending `Error` on purpose, but instead only
 * implements it. This allows us to avoid the performance penality of stack
 * traces on errors which are used for control flow.
 */
export class ClientError implements ToHttpResponse, Error {
    public readonly status: StatusCode;
    public readonly message: string;

    public constructor(status: StatusCode, message: string) {
        this.status = status;
        this.message = message;
    }

    public get name(): string {
        return this.status.phrase;
    }

    public [TO_HTTP_RESPONSE](): HttpResponse {
        return HttpResponse.builder().status(this.status).body(this.message);
    }
}
