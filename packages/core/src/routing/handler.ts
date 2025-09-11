import type { AnyExtractor, Extractor } from "../extract/index.js";
import type { HttpRequest, HttpResponseLike } from "../http/index.js";
import type { HttpService } from "../service/index.js";

/**
 * Represents a function that handles an HTTP request and returns an HTTP
 * response.
 *
 * The response can either be a promise that resolves to an HTTP-like response
 * object or a direct HTTP-like response object.
 */
export type Handler = (req: HttpRequest) => Promise<HttpResponseLike> | HttpResponseLike;

/**
 * @see {@link extractHandler}
 */
export type ExtractHandler = {
    // Array form
    <Extractors extends readonly AnyExtractor[]>(
        extractors: Extractors,
        fn: (...args: ExtractorResults<Extractors>) => Promise<HttpResponseLike> | HttpResponseLike,
    ): Handler;

    // Positional form
    <Extractors extends readonly AnyExtractor[]>(
        ...args: [
            ...Extractors,
            fn: (
                ...args: NoInfer<ExtractorResults<Extractors>>
            ) => Promise<HttpResponseLike> | HttpResponseLike,
        ]
    ): Handler;
};

/**
 * Builder for creating extract-based request handlers.
 *
 * Usage:
 * ```ts
 * import { createExtractHandler } from "@taxum/core/routing";
 * import { pathParam, json } from "@taxum/core/extract";
 * import { z } from "zod";
 *
 * const handler = createExtractHandler(
 *     pathParam(z.uuid()),
 *     json(z.object({ name: z.string() })),
 * ).handler((id, body) => {
 *     // do something with `id` and `body`
 * });
 * ```
 */
export function createExtractHandler<Extractors extends readonly AnyExtractor[]>(
    ...extractors: Extractors
) {
    return {
        handler: (
            fn: (
                ...args: ExtractorResults<Extractors>
            ) => Promise<HttpResponseLike> | HttpResponseLike,
        ): Handler => {
            return async (req: HttpRequest) => {
                const values = await Promise.all(extractors.map((e) => e(req)));
                return fn(...(values as ExtractorResults<Extractors>));
            };
        },
    };
}

/**
 * Represents the result type extracted from an `Extractor`.
 *
 * This utility type is used to infer the output type `T` that is associated
 * with a given `Extractor`.
 */
export type ExtractorResult<E> = E extends Extractor<infer T> ? T : never;

/**
 * Represents the mapped results of a series of extractors.
 *
 * This generic type maps over an array of extractors and produces a resulting
 * type for each extractor within the array. It ensures that the extracted
 * results align with the respective extractor types.
 */
export type ExtractorResults<T extends readonly AnyExtractor[]> = {
    [K in keyof T]: ExtractorResult<T[K]>;
};

/**
 * A service that wraps a handler function.
 */
export class HandlerService implements HttpService<HttpResponseLike> {
    private readonly handler: Handler;

    public constructor(handler: Handler) {
        this.handler = handler;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponseLike> {
        return this.handler(req);
    }
}
