import type { AnyService, UnknownService } from "../service/index.js";
import type { Layer } from "./index.js";

export type LayerFnClosure<
    Out extends AnyService = UnknownService,
    In extends AnyService = UnknownService,
> = (inner: In) => Out;

/**
 * Returns a new {@link LayerFn} that implements {@link Layer} by calling a
 * given function.
 *
 * @example
 * ```ts
 * import { layerFn } from "@taxum/core/layer";
 * import { serviceFn, type Service } from "@taxum/core/service";
 *
 * // A middleware that logs requests before forwarding them to another service.
 * class LogService implements Service<string, string> {
 *     public constructor(private readonly inner: Service) {}
 *
 *     public async invoke(req: string): Promise<string> {
 *         console.log("Request received", req);
 *         return await this.inner.invoke(req);
 *     }
 * }
 *
 * // A `Layer` that wraps services in `LogService`.
 * const logLayer = layerFn(
 *     (inner: Service<string, string>) => new LogService(inner)
 * );
 *
 * // An example service.
 * const service = serviceFn((req: string) => req.toUpperCase());
 *
 * // Wrap our service in a `LogService` so requests are logged.
 * const wrappedService = logLayer.layer(service);
 * ```
 */
export const layerFn = <
    Out extends AnyService = UnknownService,
    In extends AnyService = UnknownService,
>(
    f: LayerFnClosure<Out, In>,
): Layer<Out, In> => new LayerFn<Out, In>(f);

/**
 * A {@link Layer} implemented by a closure.
 *
 * @see {@link layerFn}
 */
export class LayerFn<
    Out extends AnyService = UnknownService,
    In extends AnyService = UnknownService,
> implements Layer<Out, In>
{
    private readonly f: LayerFnClosure<Out, In>;

    public constructor(f: LayerFnClosure<Out, In>) {
        this.f = f;
    }

    public layer(inner: In): Out {
        return this.f(inner);
    }
}
