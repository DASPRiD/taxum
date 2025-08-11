import assert from "node:assert";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type HttpRequest, StatusCode } from "../http/index.js";
import { PATH_PARAMS } from "../routing/index.js";
import { ValidationError } from "./error.js";
import type { Extractor } from "./index.js";

export class InvalidPathParamsError extends ValidationError {
    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        super(StatusCode.BAD_REQUEST, "Invalid path params", issues, "path");
    }
}

/**
 * Extractor that will get path params from the URL and parse them.
 *
 * The schema can be anything implementing the [Standard Schema](https://standardschema.dev/).
 *
 * If the params cannot be parsed, it will reject the request with a
 * `400 Bad Request` response.
 *
 * @example
 * ```ts
 * import { pathParams } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 * import { z } from "zod";
 *
 * const pathParamsSchema = z.object({
 *     foo: z.string(),
 * });
 *
 * const handler = handler([pathParams(pathParamsSchema)], ({foo}) => {
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users/:foo", m.post(handler));
 * ```
 *
 * @throws {@link InvalidPathParamsError} if the params cannot be parsed.
 */
export const pathParams =
    <T extends StandardSchemaV1>(schema: T): Extractor<StandardSchemaV1.InferOutput<T>> =>
    async (req: HttpRequest): Promise<StandardSchemaV1.InferOutput<T>> => {
        const pathParams = req.extensions.get(PATH_PARAMS);
        assert(pathParams, "Path params not found. Did you forget to use the path router?");

        const parseResult = await schema["~standard"].validate(pathParams);

        if (parseResult.issues) {
            throw new InvalidPathParamsError(parseResult.issues);
        }

        return parseResult.value;
    };
