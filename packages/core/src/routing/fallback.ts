import type { Layer } from "./layer.js";
import type { ServiceFn } from "./service.js";

/**
 * Represents a Fallback that wraps a service function and applies layers to it.
 */
export class Fallback {
    public service: ServiceFn;

    public constructor(service: ServiceFn) {
        this.service = service;
    }

    public map(layer: Layer) {
        this.service = layer.layer(this.service);
    }
}
