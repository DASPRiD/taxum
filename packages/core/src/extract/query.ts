import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parseSearchParams } from "nested-search-params";
import {
    type HttpRequest,
    type HttpResponse,
    jsonResponse,
    StatusCode,
    type ToHttpResponse,
} from "../http/index.js";
import type { Extractor } from "./index.js";

export class InvalidQueryDataError implements ToHttpResponse {
    public readonly issues: readonly StandardSchemaV1.Issue[];

    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        this.issues = issues;
    }

    public toHttpResponse(): HttpResponse {
        const response = jsonResponse(this.issues).toHttpResponse();
        response.status = StatusCode.BAD_REQUEST;
        return response;
    }
}

/**
 * Extractor that parses the query through a schema.
 *
 * The schema can be anything implementing the [Standard Schema](https://standardschema.dev/).
 *
 * If the query cannot be parsed, it will reject the request with a
 * `400 Bad Request` response.
 *
 * @example
 * ```ts
 * import { query } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 * import { z } from "zod";
 *
 * const paginationSchema = z.object({
 *     page: z.coerce.number().int().nonnegative(),
 * });
 *
 * const handler = handler([query(paginationSchema)], (pagination) => {
 *     const page = pagination.page;
 *
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users", m.get(handler));
 * ```
 */
export const query =
    <T extends StandardSchemaV1>(schema: T): Extractor<StandardSchemaV1.InferOutput<T>> =>
    async (req: HttpRequest): Promise<StandardSchemaV1.InferOutput<T>> => {
        const nested = parseSearchParams(req.uri.searchParams);
        const parseResult = await schema["~standard"].validate(nested);

        if (parseResult.issues) {
            throw new InvalidQueryDataError(parseResult.issues);
        }

        return parseResult.value;
    };
