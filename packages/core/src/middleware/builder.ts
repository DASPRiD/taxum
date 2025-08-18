import type { HttpResponse, HttpResponseLike } from "../http/index.js";
import { Identity, type Layer, Stack } from "../layer/index.js";
import type {
    AnyService,
    HttpService,
    InferRequest,
    InferResponse,
    Service,
} from "../service/index.js";
import { CatchErrorLayer, MapToHttpResponseLayer } from "../util/index.js";
import { SetClientIpLayer } from "./client-ip.js";
import { ResponseCompressionLayer } from "./compression.js";
import { RequestDecompressionLayer } from "./decompression.js";
import { type FromFnClosure, FromFnLayer } from "./from-fn.js";
import { RequestBodyLimitLayer } from "./limit.js";
import { type MakeRequestId, PropagateRequestIdLayer, SetRequestIdLayer } from "./request-id.js";

/**
 * Declaratively construct a {@link Service} values.
 *
 * `ServiceBuilder provides a builder-like interface for composing layers to be
 * applied to a `Service`.
 */
export class ServiceBuilder<Out extends AnyService, In extends AnyService>
    implements Layer<Out, In>
{
    private readonly inner: Layer<Out, In>;

    private constructor(layer: Layer<Out, In>) {
        this.inner = layer;
    }

    /**
     * Creates a new {@link ServiceBuilder}.
     */
    public static create(): ServiceBuilder<HttpService<HttpResponseLike>, HttpService> {
        return new ServiceBuilder(new Identity<HttpService<HttpResponseLike>>());
    }

    /**
     * Applies a {@link Layer} to the next service.
     */
    public withLayer<TOut extends In, TIn extends AnyService>(
        layer: Layer<TOut, TIn>,
    ): ServiceBuilder<Out, TIn> {
        return new ServiceBuilder(new Stack(layer, this.inner));
    }

    /**
     * Applies a middleware function to the next service.
     *
     * @see {@link FromFnLayer}
     */
    public fromFn<
        Next extends AnyService,
        Request extends InferRequest<In>,
        Response extends InferResponse<In>,
    >(f: FromFnClosure<Next, Request, Response>): ServiceBuilder<Out, Next> {
        return this.withLayer(new FromFnLayer(f) as unknown as Layer<In, Next>);
    }

    /**
     * Catches errors of the following services and produces HTTP responses.
     *
     * @see {@link CatchErrorLayer}
     */
    public catchError(this: ServiceBuilder<Out, HttpService>): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new CatchErrorLayer());
    }

    /**
     * Map {@link HttpResponseLike} of the next service to an{@link HttpResponse}.
     *
     * @see {@link MapToHttpResponseLayer}
     */
    public mapToHttpResponse(
        this: ServiceBuilder<Out, HttpService>,
    ): ServiceBuilder<Out, HttpService<HttpResponseLike>> {
        return this.withLayer(new MapToHttpResponseLayer());
    }

    /**
     * Set client IP from the request.
     *
     * @see {@link SetClientIpLayer}
     */
    public setClientIp(
        this: ServiceBuilder<Out, AnyService>,
        trustProxy = false,
    ): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new SetClientIpLayer(trustProxy));
    }

    /**
     * Compress response bodies.
     *
     * @see {@link ResponseCompressionLayer}
     */
    public compression(this: ServiceBuilder<Out, AnyService>): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new ResponseCompressionLayer());
    }

    /**
     * Decompress request bodies.
     *
     * @see {@link RequestDecompressionLayer}
     */
    public decompression(this: ServiceBuilder<Out, AnyService>): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new RequestDecompressionLayer());
    }

    /**
     * Add request ID header and extension.
     *
     * @see {@link SetRequestIdLayer}
     */
    public setRequestId(
        this: ServiceBuilder<Out, HttpService>,
        headerName?: string,
        makeRequestId?: MakeRequestId,
    ): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new SetRequestIdLayer(headerName, makeRequestId));
    }

    /**
     * Propagate request IDs from request to response.
     *
     * @see {@link PropagateRequestIdLayer}
     */
    public propagateRequestId(
        this: ServiceBuilder<Out, HttpService>,
        headerName?: string,
    ): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new PropagateRequestIdLayer(headerName));
    }

    /**
     * Intercept requests with oversized payloads and convert them into
     * `4013 Payload Too Large` responses.
     *
     * @see {@link RequestBodyLimitLayer}
     */
    public requestBodyLimit(
        this: ServiceBuilder<Out, HttpService>,
        limit: number,
    ): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new RequestBodyLimitLayer(limit));
    }

    public layer(inner: In): Out {
        return this.inner.layer(inner);
    }
}
