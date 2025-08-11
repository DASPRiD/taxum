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
 * Extractor that will get a single path param from the URL and parse it.
 *
 * The schema can be anything implementing the [Standard Schema](https://standardschema.dev/).
 *
 * If your path contains more than one value, you must use {@link pathParams}
 * instead.
 *
 * If the param cannot be parsed, it will reject the request with a
 * `400 Bad Request` response.
 *
 * @example
 * ```ts
 * import { pathParam } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 * import { z } from "zod";
 *
 * const handler = handler([pathParam(z.uuid())], ({id}) => {
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users/:id", m.get(handler));
 * ```
 *
 * @throws {@link !Error} if path params have more than one value.
 * @throws {@link InvalidPathParamsError} if the params cannot be parsed.
 */
export const pathParam =
    <T extends StandardSchemaV1>(schema: T): Extractor<StandardSchemaV1.InferOutput<T>> =>
    async (req: HttpRequest): Promise<StandardSchemaV1.InferOutput<T>> => {
        const pathParams = req.extensions.get(PATH_PARAMS);
        assert(pathParams, "Path params not found. Did you forget to use the path router?");

        const paramEntries = Object.entries(pathParams);
        assert(paramEntries.length === 1, "Path params must have exactly one value");

        const [paramName, paramValue] = paramEntries[0];

        const parseResult = await schema["~standard"].validate(paramValue);

        if (parseResult.issues) {
            throw new InvalidPathParamsError(
                parseResult.issues.map((issue) => ({
                    ...issue,
                    /* node:coverage ignore next */
                    path: issue.path === undefined ? [paramName] : [paramName, ...issue.path],
                })),
            );
        }

        return parseResult.value;
    };

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
