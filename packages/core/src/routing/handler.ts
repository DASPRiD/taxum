import type { AnyExtractor, Extractor } from "../extract/index.js";
import type { HttpRequest, HttpResponseLike } from "../http/index.js";

/**
 * Represents a function that handles an HTTP request and returns an HTTP
 * response.
 *
 * The response can either be a promise that resolves to an HTTP-like response
 * object or a direct HTTP-like response object.
 */
export type HandlerFn = (req: HttpRequest) => Promise<HttpResponseLike> | HttpResponseLike;

/**
 * Creates a handler function that processes an HTTP request using the provided
 * extractors and function.
 *
 * @typeParam Extractors - a tuple type representing the array of extractor functions.
 * @typeParam Args - a tuple type representing the results derived from the extractors.
 *
 * @param extractors - an array of functions used to extract data from the
 *        incoming HTTP request. Each extractor function is expected to accept
 *        an HttpRequest object and return a value or a Promise resolving to a
 *        value.
 * @param fn - a function that takes the extracted values and processes them,
 *        returning either a synchronous or asynchronous HTTP-like response
 *        object.
 */
export const handler = <
    Extractors extends readonly AnyExtractor[],
    Args extends ExtractorResults<Extractors>,
>(
    extractors: Extractors,
    fn: (...args: Args) => Promise<HttpResponseLike> | HttpResponseLike,
): HandlerFn => {
    return async (req: HttpRequest) => {
        const values = (await Promise.all(extractors.map((e) => e(req)))) as unknown as Args;
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
