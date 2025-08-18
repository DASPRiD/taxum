import type { Service } from "./index.js";

export type ServiceFnClosure<Request, Response> = (req: Request) => Promise<Response> | Response;

/**
 * Returns a new {@link ServiceFn} with a given closure..
 *
 * @example
 * ```ts
 * import { serviceFn } from "@taxum/core/service";
 *
 * const service = serviceFn(
 *     (req) => HttpResponse.builder().body("Hello World")
 * );
 * ```
 */
export const serviceFn = <Request, Response>(
    f: ServiceFnClosure<Request, Response>,
): Service<Request, Response> => new ServiceFn<Request, Response>(f);

/**
 * A {@link Service} implemented by a closure.
 *
 * @see {@link serviceFn}
 */
export class ServiceFn<Request, Response> implements Service<Request, Response> {
    private readonly f: ServiceFnClosure<Request, Response>;

    public constructor(f: ServiceFnClosure<Request, Response>) {
        this.f = f;
    }

    public async invoke(req: Request): Promise<Response> {
        return this.f(req);
    }
}
