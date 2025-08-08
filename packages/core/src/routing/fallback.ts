import type { Route } from "./route.js";

/**
 * Represents a Fallback that wraps a service function and applies layers to it.
 *
 * @internal
 */
export class Fallback {
    public readonly route: Route;
    public readonly isDefault;

    private constructor(route: Route, isDefault: boolean) {
        this.route = route;
        this.isDefault = isDefault;
    }

    public static default(route: Route): Fallback {
        return new Fallback(route, true);
    }

    public static service(route: Route): Fallback {
        return new Fallback(route, false);
    }

    public map(fn: (route: Route) => Route): Fallback {
        return new Fallback(fn(this.route), this.isDefault);
    }
}
