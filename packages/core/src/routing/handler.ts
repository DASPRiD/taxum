import type { AnyExtractor, Extractor } from "../extract/index.js";
import { type HttpRequest, HttpResponse, type HttpResponseLike } from "../http/index.js";
import type { Service } from "./service.js";

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
    <Extractors extends readonly AnyExtractor[], Args extends ExtractorResults<Extractors>>(
        extractors: Extractors,
        fn: (...args: Args) => Promise<HttpResponseLike> | HttpResponseLike,
    ): Handler;

    // Positional form
    <Extractors extends readonly AnyExtractor[], Args extends ExtractorResults<Extractors>>(
        ...args: [
            ...Extractors,
            fn: (...args: Args) => Promise<HttpResponseLike> | HttpResponseLike,
        ]
    ): Handler;
};

/**
 * Creates a request handler that processes an HTTP request using the provided
 * extractors and function.
 *
 * This allows you to separate request data parsing (via extractors) from
 * business logic (the handler), making route definitions cleaner and more
 * type-safe.
 *
 * You can either pass in each extractor individually as positional arguments
 * or all extractors as a single array as the first argument.
 *
 * ## Behavior
 *
 * - All extractors are executed in parallel via `Promise.all()`.
 * - If an extractor throws, the error is propagated to the router’s
 *   error handler.
 * - The order of extractor definitions determines the order of arguments
 *   passed to the handler.
 *
 * @example
 * ```ts
 * import { extractHandler } from "@taxum/core/routing";
 * import { pathParam, json } from "@taxum/core/extract";
 * import { z } from "zod";
 *
 * const handler = extractHandler(
 *     pathParam(z.uuid()),
 *     json(z.object({ name: z.string() }})),
 *     (id, body) => {
 *         // do something with `id` and `body`
 *     },
 * );
 * ```
 *
 * @example
 * ```ts
 * import { extractHandler } from "@taxum/core/routing";
 * import { pathParam, json } from "@taxum/core/extract";
 * import { z } from "zod";
 *
 * const handler = extractHandler(
 *     [
 *         pathParam(z.uuid()),
 *         json(z.object({ name: z.string() }})),
 *     ],
 *     (id, body) => {
 *         // do something with `id` and `body`
 *     },
 * );
 * ```
 */
export const extractHandler: ExtractHandler = (...args: unknown[]): Handler => {
    let extractors: readonly AnyExtractor[];
    let fn: (...args: unknown[]) => Promise<HttpResponseLike> | HttpResponseLike;

    if (Array.isArray(args[0])) {
        extractors = args[0] as readonly AnyExtractor[];
        fn = args[1] as (...args: unknown[]) => Promise<HttpResponseLike> | HttpResponseLike;
    } else {
        extractors = args.slice(0, -1) as readonly AnyExtractor[];
        fn = args[args.length - 1] as (
            ...args: unknown[]
        ) => Promise<HttpResponseLike> | HttpResponseLike;
    }

    return async (req: HttpRequest) => {
        const values = await Promise.all(extractors.map((e) => e(req)));
        return fn(...values);
    };
};

/**
 * Represents the result type extracted from an `Extractor`.
 *
 * This utility type is used to infer the output type `T` that is associated
 * with a given `Extractor`.
 *
 * @typeParam E - the input extractor type from which the result type is
 *            inferred.
 */
export type ExtractorResult<E> = E extends Extractor<infer T> ? T : never;

/**
 * Represents the mapped results of a series of extractors.
 *
 * This generic type maps over an array of extractors and produces a resulting
 * type for each extractor within the array. It ensures that the extracted
 * results align with the respective extractor types.
 *
 * @typeParam T - the array of extractor types which extend
 *            `readonly AnyExtractor[]`.
 */
export type ExtractorResults<T extends readonly AnyExtractor[]> = {
    [K in keyof T]: ExtractorResult<T[K]>;
};

/**
 * A service that wraps a handler function.
 */
export class HandlerService implements Service {
    private readonly handler: Handler;

    public constructor(handler: Handler) {
        this.handler = handler;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        return HttpResponse.from(await this.handler(req));
    }
}
