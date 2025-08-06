import type { HttpRequest } from "../http/index.js";
import type { Extractor } from "./index.js";

/**
 * Extractor that extracts the raw query without processing it.
 *
 * @example
 * ```ts
 * import { rawQuery } from "@taxum/core/extract";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const handler = handler([rawQuery], (query) => {
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users", m.get(handler));
 * ```
 */
export const rawQuery: Extractor<URLSearchParams> = (req: HttpRequest): URLSearchParams => {
    return req.uri.searchParams;
};
