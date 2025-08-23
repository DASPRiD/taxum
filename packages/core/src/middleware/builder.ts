import type { HttpRequest, HttpResponse, HttpResponseLike } from "../http/index.js";
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
import {
    SetSensitiveHeadersLayer,
    SetSensitiveRequestHeadersLayer,
    SetSensitiveResponseHeadersLayer,
} from "./sensitive-headers.js";
import {
    type MakeHeaderValue,
    SetRequestHeaderLayer,
    SetResponseHeaderLayer,
} from "./set-header.js";
import { TraceLayer } from "./trace.js";

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
     * Applies an optional {@link Layer} to the next service.
     *
     * An optional layer is only possible when the consumed service equals the
     * produced service.
     */
    public withOptionLayer<TOut extends In, TIn extends In>(
        layer: Layer<TOut, TIn> | null | undefined,
    ): ServiceBuilder<Out, TIn> {
        return new ServiceBuilder(new Stack(layer ?? new Identity(), this.inner));
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

    /* node:coverage disable: no need to cover proxy methods */

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
     * Trace HTTP requests and responses.
     *
     * @see {@link TraceLayer}
     */
    public traceHttp(this: ServiceBuilder<Out, HttpService>): ServiceBuilder<Out, HttpService> {
        return this.withLayer(new TraceLayer());
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

    /**
     * Mark headers as sensitive on both requests and responses.
     *
     * @see {@link SetSensitiveHeadersLayer}
     */
    public sensitiveHeaders(this: ServiceBuilder<Out, HttpService>, headers: string[]) {
        return this.withLayer(new SetSensitiveHeadersLayer(headers));
    }

    /**
     * Mark headers as sensitive on requests.
     *
     * @see {@link SetSensitiveRequestHeadersLayer}
     */
    public sensitiveRequestHeaders(this: ServiceBuilder<Out, HttpService>, headers: string[]) {
        return this.withLayer(new SetSensitiveRequestHeadersLayer(headers));
    }

    /**
     * Mark headers as sensitive on responses.
     *
     * @see {@link SetSensitiveRequestHeadersLayer}
     */
    public sensitiveResponseHeaders(this: ServiceBuilder<Out, HttpService>, headers: string[]) {
        return this.withLayer(new SetSensitiveResponseHeadersLayer(headers));
    }

    /**
     * Insert a header into the request.
     *
     * If a previous value exists for the same header, it is removed and
     * replaced with a new header value.
     *
     * @see {@link SetRequestHeaderLayer}
     */
    public overrideRequestHeader(
        this: ServiceBuilder<Out, HttpService>,
        headerName: string,
        make: MakeHeaderValue<HttpRequest>,
    ) {
        return this.withLayer(SetRequestHeaderLayer.overriding(headerName, make));
    }

    /**
     * Append a header into the request.
     *
     * If previous values exist, the header will have multiple values.
     *
     * @see {@link SetRequestHeaderLayer}
     */
    public appendRequestHeader(
        this: ServiceBuilder<Out, HttpService>,
        headerName: string,
        make: MakeHeaderValue<HttpRequest>,
    ) {
        return this.withLayer(SetRequestHeaderLayer.appending(headerName, make));
    }

    /**
     * Insert a header into the request if the header is not already present.
     *
     * @see {@link SetRequestHeaderLayer}
     */
    public insertRequestHeaderIfNotPresent(
        this: ServiceBuilder<Out, HttpService>,
        headerName: string,
        make: MakeHeaderValue<HttpRequest>,
    ) {
        return this.withLayer(SetRequestHeaderLayer.ifNotPresent(headerName, make));
    }

    /**
     * Insert a header into the response.
     *
     * If a previous value exists for the same header, it is removed and
     * replaced with a new header value.
     *
     * @see {@link SetResponseHeaderLayer}
     */
    public overrideResponseHeader(
        this: ServiceBuilder<Out, HttpService>,
        headerName: string,
        make: MakeHeaderValue<HttpResponse>,
    ) {
        return this.withLayer(SetResponseHeaderLayer.overriding(headerName, make));
    }

    /**
     * Append a header into the response.
     *
     * If previous values exist, the header will have multiple values.
     *
     * @see {@link SetResponseHeaderLayer}
     */
    public appendResponseHeader(
        this: ServiceBuilder<Out, HttpService>,
        headerName: string,
        make: MakeHeaderValue<HttpResponse>,
    ) {
        return this.withLayer(SetResponseHeaderLayer.appending(headerName, make));
    }

    /**
     * Insert a header into the response if the header is not already present.
     *
     * @see {@link SetResponseHeaderLayer}
     */
    public insertResponseHeaderIfNotPresent(
        this: ServiceBuilder<Out, HttpService>,
        headerName: string,
        make: MakeHeaderValue<HttpResponse>,
    ) {
        return this.withLayer(SetResponseHeaderLayer.ifNotPresent(headerName, make));
    }

    /* node:coverage enable */

    public layer(inner: In): Out {
        return this.inner.layer(inner);
    }
}
