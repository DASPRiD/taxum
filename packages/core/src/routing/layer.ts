import type { ServiceFn } from "./service.js";

/**
 * Represents a Layer that can wrap a service for adding functionality.
 */
export type Layer = {
    layer: (inner: ServiceFn) => ServiceFn;
};
