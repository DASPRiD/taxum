import assert from "node:assert";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type HttpRequest, HttpResponse, StatusCode, type ToHttpResponse } from "../http/index.js";
import { PATH_PARAMS } from "../routing/index.js";
import { ValidationError } from "./error.js";
import type { Extractor } from "./index.js";

export class InvalidPathParamsError extends ValidationError implements ToHttpResponse {
    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        super(issues, "path_param");
    }

    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder().status(StatusCode.BAD_REQUEST).body("Invalid path params");
    }
}

/**
 * Extractor that will get path params from the URL and parse them.
 *
 * The schema can be anything implementing the [Standard Schema](https://standardschema.dev/).
 *
 * If the params cannot be parsed, it will reject the request with a
 * `400 Bad Request` response.
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
