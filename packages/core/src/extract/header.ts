import { type HttpRequest, StatusCode } from "../http/index.js";
import { ClientError } from "../util/index.js";

export class MissingHeaderError extends ClientError {
    public constructor(headerName: string) {
        super(StatusCode.BAD_REQUEST, `Missing required header \`${headerName}\``);
    }
}

/**
 * Extractor that extracts a raw header from the request.
 *
 * If the `required` flag is not set or false, returns either the header or
 * undefined.
 *
 * Otherwise, it throws an error if the header is missing.
 *
 * @example
 * ```ts
 * import { header } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const handler = handler([header("if-none-match")], (etag) => {
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users", m.get(handler));
 * ```
 *
 * @throws {@link MissingHeaderError} if header is required but missing.
 */
export const header =
    <B extends boolean = false>(headerName: string, required?: B) =>
    async (req: HttpRequest): Promise<B extends true ? string : string | undefined> => {
        const header = req.headers.get(headerName);

        if (!required) {
            return header?.value as B extends true ? string : string | undefined;
        }

        if (header === null) {
            throw new MissingHeaderError(headerName);
        }

        return header.value;
    };
