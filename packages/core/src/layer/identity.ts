import type { AnyService, UnknownService } from "../service/index.js";
import type { Layer } from "./index.js";

export class Identity<S extends AnyService = UnknownService> implements Layer<S, S> {
    public layer(inner: S): S {
        return inner;
    }
}
