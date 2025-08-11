import type { StandardSchemaV1 } from "@standard-schema/spec";
import { HttpResponse, type StatusCode, type ToHttpResponse } from "../http/index.js";

/**
 * Base class for errors thrown during extraction.
 */
export class ExtractError implements ToHttpResponse {
    public readonly status: StatusCode;
    public readonly message: string;

    public constructor(status: StatusCode, message: string) {
        this.status = status;
        this.message = message;
    }

    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder().status(this.status).body(this.message);
    }
}

export type ValidationErrorSource = "body" | "search_params" | "path" | "header";

/**
 * Error thrown when a schema validation fails.
 */
export class ValidationError extends ExtractError {
    public readonly issues: readonly StandardSchemaV1.Issue[];
    public readonly source: ValidationErrorSource;

    public constructor(
        status: StatusCode,
        message: string,
        issues: readonly StandardSchemaV1.Issue[],
        source: ValidationErrorSource,
    ) {
        super(status, message);
        this.issues = issues;
        this.source = source;
    }
}
