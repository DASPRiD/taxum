/**
 * The routing module provides a comprehensive set of components for handling
 * HTTP routing and request processing.
 *
 * Key components:
 *
 * - {@link Handler} - core request handler functions
 * - {@link Layer} - middleware layers for request/response processing
 * - {@link MethodFilter} - HTTP method filtering capabilities
 * - Method and path-based routing functionality
 * - Service-oriented request handling
 *
 * This module enables building flexible and type-safe HTTP routing systems with
 * middleware support, method filtering, and structured request handling.
 *
 * @packageDocumentation
 *
 * @example
 * ```ts
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World!"));
 * ```
 */

export * from "./eror-handler.js";
export * from "./handler.js";
export * from "./layer.js";
export * from "./method-filter.js";
export * from "./method-router.js";
export * from "./path-router.js";
export * from "./router.js";
export * from "./service.js";
export * from "./util.js";
