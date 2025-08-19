import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StatusCode } from "../http/index.js";
import { ClientError } from "../util/index.js";

export type ValidationErrorSource = "body" | "search_params" | "path" | "header";

/**
 * Error thrown when a schema validation fails.
 */
export class ValidationError extends ClientError {
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
