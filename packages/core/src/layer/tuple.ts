import type { AnyService } from "../service/index.js";
import type { AnyLayer, InferIn, InferOut, Layer } from "./index.js";

/**
 * Combines one or more layers into a composite layer.
 *
 * Layers defined as a tuple are applied from the inside out. This means that
 * the last layer becomes the innermost layer, while the first layer becomes the
 * outermost layer.
 */
export const layerTuple = <Layers extends readonly [AnyLayer, ...AnyLayer[]]>(
    ...layers: LayerChain<Layers>
): LayerTuple<Layers> => {
    return new LayerTuple(layers);
};

/**
 * A combination of multiple layers.
 *
 * @see {@link layerTuple}
 */
export class LayerTuple<
    Layers extends readonly [AnyLayer, ...AnyLayer[]],
    Out extends InferOut<FirstLayer<Layers>> = InferOut<FirstLayer<Layers>>,
    In extends InferIn<LastLayer<Layers>> = InferIn<LastLayer<Layers>>,
> implements Layer<Out, In>
{
    private readonly layers: LayerChain<Layers>;

    public constructor(layers: LayerChain<Layers>) {
        this.layers = layers;
    }

    public layer(inner: In): Out {
        return (this.layers as readonly Layer<AnyService, AnyService>[]).reduceRight<AnyService>(
            (svc, l) => l.layer(svc),
            inner,
        ) as unknown as Out;
    }
}

export type FirstLayer<T extends readonly unknown[]> = T[0];
export type LastLayer<T extends readonly unknown[]> = T extends readonly [...unknown[], infer U]
    ? U
    : FirstLayer<T>;

export type LayerChain<Layers extends readonly [AnyLayer, ...AnyLayer[]]> = Layers &
    ValidateLayerChain<Layers>;

export type ValidateLayerChain<Layers extends readonly [AnyLayer, ...AnyLayer[]]> = Layers extends [
    infer L1 extends AnyLayer,
    infer L2 extends AnyLayer,
    ...infer Rest extends AnyLayer[],
]
    ? [Layer<InferOut<L1>, InferOut<L2>>, ...ValidateLayerChain<[L2, ...Rest]>]
    : Layers extends [infer Last extends AnyLayer]
      ? [Layer<InferOut<Last>, InferIn<Last>>]
      : never;
