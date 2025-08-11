/**
 * Common extractors used in HTTP processing.
 *
 * @packageDocumentation
 */

import type { HttpRequest } from "../http/request.js";

export type Extractor<T> = (req: HttpRequest) => Promise<T> | T;
// biome-ignore lint/suspicious/noExplicitAny: required for inference
export type AnyExtractor = Extractor<any>;

export * from "./error.js";
export * from "./extension.js";
export * from "./form.js";
export * from "./json.js";
export * from "./path.js";
export * from "./query.js";
export * from "./raw-query.js";
