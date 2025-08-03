import type { ExtensionKey, HttpRequest } from "../http/index.js";

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
