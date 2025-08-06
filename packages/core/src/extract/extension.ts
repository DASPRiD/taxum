import type { ExtensionKey, HttpRequest } from "../http/index.js";

/**
 * Extractor that extracts a raw extension from the request.
 *
 * If the `required` flag is not set or false, returns either the extension or
 * undefined.
 *
 * Otherwise, it throws an error if the extension is missing.
 *
 * @example
 * ```ts
 * import { extension } from "@taxum/core/extract";
 * import { ExtensionKey } from "@taxum/core/http";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const MY_EXTENSION = new ExtensionKey<string>("My extension");
 *
 * const handler = handler([extension(MY_EXTENSION)], (extension) => {
 *     // ...
 * });
 *
 * const router = new Router()
 *     .route("/users", m.get(handler));
 * ```
 */
export const extension =
    <T, B extends boolean = false>(key: ExtensionKey<T>, required?: B) =>
    async (req: HttpRequest): Promise<B extends true ? T : T | undefined> => {
        const extension = req.extensions.get(key);

        if (!required) {
            return extension as B extends true ? T : T | undefined;
        }

        if (extension === undefined) {
            throw new Error(`Missing extension: ${key}`);
        }

        return extension;
    };
