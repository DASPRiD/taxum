import consumers from "node:stream/consumers";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parseSearchParams } from "nested-search-params";
import {
    type HttpRequest,
    HttpResponse,
    Method,
    StatusCode,
    type ToHttpResponse,
} from "../http/index.js";
import { ValidationError } from "./error.js";
import type { Extractor } from "./index.js";

export class MissingFormDataContentTypeError implements ToHttpResponse {
    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder()
            .status(StatusCode.UNSUPPORTED_MEDIA_TYPE)
            .body("Expected request with `Content-Type: application/x-www-form-urlencoded`");
    }
}

export class InvalidFormDataError extends ValidationError implements ToHttpResponse {
    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        super(issues, "body");
    }

    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder()
            .status(StatusCode.UNPROCESSABLE_CONTENT)
            .body("Invalid form data");
    }
}

/**
 * Extractor that will get form data from the request and parse it.
 *
 * The schema can be anything implementing the [Standard Schema](https://standardschema.dev/).
 *
 * The source of the form data depends on the request method:
 *
 * - If the request has a method of `GET` or `HEAD", the form data will be read
 *   from the query string.
 * - If the request has a different method, the form will be read from the body
 *   of the request. It must have a `content-type` of
 *   `application/x-www-form-urlencoded` for this to work.
 *
 * If the request is not `GET` or `HEAD` and is lacking a form data content
 * type, it will reject the request with a `415 Unsupported Media Type`
 * response.
 *
 * If the body is malformed, it will reject the request with a `400 Bad Request`
 * response.
 *
 * If the form data cannot be parsed, it will reject the request with a
 * `422 Unprocessable Content` response.
 *
 * @example
 * ```ts
 * import { form } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 * import { z } from "zod";
 *
 * const bodySchema = z.object({
 *     foo: z.string(),
 * });
 *
 * const handler = handler([form(bodySchema)], (body) => {
 *     const foo = body.foo;
 *
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users", m.post(handler));
 * ```
 */
export const form =
    <T extends StandardSchemaV1>(schema: T): Extractor<StandardSchemaV1.InferOutput<T>> =>
    async (req: HttpRequest): Promise<StandardSchemaV1.InferOutput<T>> => {
        let source: URLSearchParams;

        if (req.method.equals(Method.GET) || req.method.equals(Method.HEAD)) {
            source = req.uri.searchParams;
        } else {
            if (req.head.headers.get("content-type") !== "application/x-www-form-urlencoded") {
                throw new MissingFormDataContentTypeError();
            }

            const body = await consumers.text(req.body);
            source = new URLSearchParams(body);
        }

        const nested = parseSearchParams(source);
        const parseResult = await schema["~standard"].validate(nested);

        if (parseResult.issues) {
            throw new InvalidFormDataError(parseResult.issues);
        }

        return parseResult.value;
    };
