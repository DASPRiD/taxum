import consumers from "node:stream/consumers";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import MIMEType from "whatwg-mimetype";
import { type HeaderMap, type HttpRequest, StatusCode } from "../http/index.js";
import { ExtractError, ValidationError } from "./error.js";
import type { Extractor } from "./index.js";

export class MissingJsonContentTypeError extends ExtractError {
    public constructor() {
        super(
            StatusCode.UNSUPPORTED_MEDIA_TYPE,
            "Expected request with `Content-Type: application/json`",
        );
    }
}

export class MalformedJsonError extends ExtractError {
    public constructor(reason: string) {
        super(StatusCode.BAD_REQUEST, reason);
    }
}

export class InvalidJsonError extends ValidationError {
    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        super(StatusCode.UNPROCESSABLE_CONTENT, "Invalid JSON", issues, "body");
    }
}

/**
 * Extractor that will get JSON from the body and parse it.
 *
 * The schema can be anything implementing the [Standard Schema](https://standardschema.dev/).
 *
 * If the request is lacking a JSON content type, it will reject the request
 * with a `415 Unsupported Media Type` response.
 *
 * If the body is malformed, it will reject the request with a `400 Bad Request`
 * response.
 *
 * If the JSON cannot be parsed, it will reject the request with a
 * `422 Unprocessable Content` response.
 *
 * @example
 * ```ts
 * import { json } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 * import { z } from "zod";
 *
 * const bodySchema = z.object({
 *     foo: z.string(),
 * });
 *
 * const handler = handler([json(bodySchema)], (body) => {
 *     const foo = body.foo;
 *
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users", m.post(handler));
 * ```
 *
 * @throws {@link MissingJsonContentTypeError} if the request is lacking a JSON content type.
 * @throws {@link MalformedJsonError} if the body is malformed.
 * @throws {@link InvalidJsonError} if the JSON cannot be parsed.
 */
export const json =
    <T extends StandardSchemaV1>(schema: T): Extractor<StandardSchemaV1.InferOutput<T>> =>
    async (req: HttpRequest): Promise<StandardSchemaV1.InferOutput<T>> => {
        if (!isJsonContentType(req.head.headers)) {
            throw new MissingJsonContentTypeError();
        }

        let json: unknown;

        try {
            json = await consumers.json(req.body);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new MalformedJsonError(error.message);
            }

            throw error;
        }

        const parseResult = await schema["~standard"].validate(json);

        if (parseResult.issues) {
            throw new InvalidJsonError(parseResult.issues);
        }

        return parseResult.value;
    };

const isJsonContentType = (headers: HeaderMap): boolean => {
    const contentType = headers.get("content-type");

    if (!contentType) {
        return false;
    }

    const mimeType = new MIMEType(contentType);

    return (
        mimeType.type === "application" &&
        (mimeType.subtype === "json" || mimeType.subtype.endsWith("+json"))
    );
};
