/**
 * Module for unified HTTP request/response handling.
 *
 * This module defines the common building blocks for HTTP requests and
 * responses.
 *
 * ## ⚠ Ownership and Reuse Contract
 *
 * Instances of `HttpResponse` and its subcomponents (`HeaderMap`, `Body`,
 * `Extensions`) are intended to be **owned, single-use values**.
 *
 * - Do **not** share or reuse these instances across multiple responses,
 *   layers, global variables, or handlers.
 * - Construct fresh instances for each response to avoid **side effects, shared
 *   state bugs, and data corruption**.
 *
 * This design avoids unnecessary cloning for performance-critical applications
 * and relies on well-behaved usage. Reusing parts of a response is
 * **explicitly unsupported** and considered **undefined behavior**.
 *
 * @packageDocumentation
 */

export * from "./body.js";
export * from "./common.js";
export * from "./content-encoding.js";
export * from "./extensions.js";
export * from "./headers.js";
export * from "./method.js";
export * from "./request.js";
export * from "./response.js";
export * from "./size-hint.js";
export * from "./status.js";
export * from "./to-response.js";
export * from "./to-response-parts.js";
