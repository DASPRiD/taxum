import type { AnyService, UnknownService } from "../service/index.js";
import type { Layer } from "./index.js";

/**
 * Two {@link Layer}s chained together.
 */
export class Stack<
    In extends AnyService = UnknownService,
    Mid extends AnyService = UnknownService,
    Out extends AnyService = UnknownService,
> implements Layer<Out, In>
{
    private readonly inner: Layer<Mid, In>;
    private readonly outer: Layer<Out, Mid>;

    /**
     * Creates a new {@link Stack}.
     */
    public constructor(inner: Layer<Mid, In>, outer: Layer<Out, Mid>) {
        this.inner = inner;
        this.outer = outer;
    }

    public layer(service: In): Out {
        const inner = this.inner.layer(service);
        return this.outer.layer(inner);
    }
}
