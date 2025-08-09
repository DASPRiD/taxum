import type { StandardSchemaV1 } from "@standard-schema/spec";

export type ValidationErrorSource = "body" | "search_params" | "path_param" | "header";

export class ValidationError {
    public readonly issues: readonly StandardSchemaV1.Issue[];
    public readonly source: ValidationErrorSource;

    public constructor(issues: readonly StandardSchemaV1.Issue[], source: ValidationErrorSource) {
        this.issues = issues;
        this.source = source;
    }
}
