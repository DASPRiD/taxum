import consumers from "node:stream/consumers";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parseSearchParams } from "nested-search-params";
import {
    type HttpRequest,
    HttpResponse,
    jsonResponse,
    Method,
    StatusCode,
    type ToHttpResponse,
} from "../http/index.js";
import type { Extractor } from "./index.js";

export class MissingFormDataContentTypeError implements ToHttpResponse {
    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder()
            .status(StatusCode.UNSUPPORTED_MEDIA_TYPE)
            .body("Expected request with `Content-Type: application/x-www-form-urlencoded`");
    }
}

export class InvalidFormDataError implements ToHttpResponse {
    public readonly issues: readonly StandardSchemaV1.Issue[];

    public constructor(issues: readonly StandardSchemaV1.Issue[]) {
        this.issues = issues;
    }

    public toHttpResponse(): HttpResponse {
        const response = jsonResponse(this.issues).toHttpResponse();
        response.status = StatusCode.UNPROCESSABLE_CONTENT;
        return response;
    }
}

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
