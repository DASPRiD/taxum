import assert from "node:assert";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type HttpRequest, HttpResponse, StatusCode, type ToHttpResponse } from "../http/index.js";
import { PATH_PARAMS } from "../routing/index.js";
import type { Extractor } from "./index.js";

export class PathParamsError implements ToHttpResponse {
    public readonly issues: readonly StandardSchemaV1.Issue[];

    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        this.issues = issues;
    }

    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder().status(StatusCode.BAD_REQUEST).body(null);
    }
}

export const pathParams =
    <T extends StandardSchemaV1>(schema: T): Extractor<StandardSchemaV1.InferOutput<T>> =>
    async (req: HttpRequest): Promise<StandardSchemaV1.InferOutput<T>> => {
        const pathParams = req.extensions.get(PATH_PARAMS);
        assert(pathParams, "Path params not found. Did you forget to use the path router?");

        const parseResult = await schema["~standard"].validate(pathParams);

        if (parseResult.issues) {
            throw new PathParamsError(parseResult.issues);
        }

        return parseResult.value;
    };
