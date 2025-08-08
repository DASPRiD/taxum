import type { HttpResponse } from "../http/index.js";
import type { Service } from "./service.js";

/**
 * Represents a Layer that can wrap a service for adding functionality.
 */
export type Layer = {
    layer: (inner: Service<HttpResponse>) => Service<HttpResponse>;
};
