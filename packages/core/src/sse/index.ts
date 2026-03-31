/**
 * Server-Sent Events (SSE) support for streaming responses.
 *
 * This module provides types for constructing and sending SSE responses, including event building
 * and optional keep-alive support.
 *
 * @packageDocumentation
 */

export type { SseEvent } from "./event.js";
export { Sse, type SseKeepAliveOptions } from "./sse.js";
