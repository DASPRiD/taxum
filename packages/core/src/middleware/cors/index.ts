import assert from "node:assert";
import {
    type HeaderEntry,
    HeaderMap,
    type HttpRequest,
    HttpResponse,
    Method,
} from "../../http/index.js";
import type { HttpLayer } from "../../layer/index.js";
import type { HttpService } from "../../service/index.js";
import { AllowCredentials, type AllowCredentialsLike } from "./allow-credentials.js";
import { AllowHeaders, type AllowHeadersLike } from "./allow-headers.js";
import { AllowMethods, type AllowMethodsLike } from "./allow-methods.js";
import { AllowOrigin, type AllowOriginLike } from "./allow-origin.js";
import { AllowPrivateNetwork, type AllowPrivateNetworkLike } from "./allow-private-network.js";
import { ExposeHeaders, type ExposeHeadersLike } from "./expose-headers.js";
import { MaxAge, type MaxAgeLike } from "./max-age.js";
import { Vary, type VaryLike } from "./vary.js";

export * from "./allow-credentials.js";
export * from "./allow-headers.js";
export * from "./allow-methods.js";
export * from "./allow-origin.js";
export * from "./allow-private-network.js";
export * from "./expose-headers.js";
export * from "./max-age.js";
export * from "./support.js";
export * from "./vary.js";

/**
 * A layer that sets CORS headers on the response.
 *
 * @example
 * ```ts
 * import { CorsLayer } from "@taxum/core/middleware/cors";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(CorsLayer.permissive());
 * ```
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
 */
export class CorsLayer implements HttpLayer {
    private allowCredentials_ = AllowCredentials.default();
    private allowHeaders_ = AllowHeaders.default();
    private allowMethods_ = AllowMethods.default();
    private allowOrigin_ = AllowOrigin.default();
    private allowPrivateNetwork_ = AllowPrivateNetwork.default();
    private exposeHeaders_ = ExposeHeaders.default();
    private maxAge_ = MaxAge.default();
    private vary_ = Vary.default();

    /**
     * A permissive configuration:
     *
     * - All request headers allowed.
     * - All methods allowed.
     * - All origins allowed.
     * - All headers exposed.
     */
    public static permissive(): CorsLayer {
        return new CorsLayer()
            .allowHeaders(AllowHeaders.any())
            .allowMethods(AllowMethods.any())
            .allowOrigin(AllowOrigin.any())
            .exposeHeaders(ExposeHeaders.any());
    }

    /**
     * A very permissive configuration:
     *
     * - **Credentials allowed.**
     * - The method received in `Access-Control-Request-Method` is sent back
     *   as an allowed method.
     * - The origin of the preflight request is sent back as an allowed origin.
     * - The header names received in `Access-Control-Request-Headers` are sent
     *   back as allowed headers.
     * - No headers are currently exposed, but this may change in the future.
     */
    public static veryPermissive(): CorsLayer {
        return new CorsLayer()
            .allowCredentials(AllowCredentials.yes())
            .allowHeaders(AllowHeaders.mirrorRequest())
            .allowMethods(AllowMethods.mirrorRequest())
            .allowOrigin(AllowOrigin.mirrorRequest());
    }

    /**
     * Sets the `Access-Control-Allow-Credentials` header.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowCredentials(true);
     * ```
     */
    public allowCredentials(allowCredentials: AllowCredentialsLike): this {
        this.allowCredentials_ = AllowCredentials.from(allowCredentials);
        return this;
    }

    /**
     * Sets the `Access-Control-Allow-Headers` header.
     *
     * Note that `Access-Control-Allow-Headers` is required for requests that have
     * `Access-Control-Request-Headers`.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowHeaders(["authorization", "accept"]);
     * ```
     *
     * All headers can be allowed with:
     *
     * @example
     * ```ts
     * import { CorsLayer, ANY } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowHeaders(ANY);
     * ```
     */
    public allowHeaders(allowHeaders: AllowHeadersLike): this {
        this.allowHeaders_ = AllowHeaders.from(allowHeaders);
        return this;
    }

    /**
     * Sets the `Access-Control-Allow-Methods` header.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowMethods(["GET", "POST"]);
     * ```
     *
     * All methods can be allowed with:
     *
     * @example
     * ```ts
     * import { CorsLayer, ANY } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowMethods(ANY);
     * ```
     */
    public allowMethods(allowMethods: AllowMethodsLike): this {
        this.allowMethods_ = AllowMethods.from(allowMethods);
        return this;
    }

    /**
     * Sets the `Access-Control-Allow-Origin` header.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowOrigin("https://example.com");
     * ```
     *
     * Multiple origins can be allowed with:
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowOrigin(["http://example.com", "https://api.example.com"]);
     * ```
     *
     * All origins can be allowed with:
     *
     * @example
     * ```ts
     * import { CorsLayer, ANY } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowOrigin(ANY);
     * ```
     *
     * You can also use a function to dynamically determine the allowed origin:
     *
     * @example
     * ```ts
     * import { CorsLayer, ANY } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowOrigin((origin, parts) => {
     *     if (req.headers.get("x-custom-header") === "true") {
     *         return "https://example.com";
     *     }
     * });
     */
    public allowOrigin(allowOrigin: AllowOriginLike): this {
        this.allowOrigin_ = AllowOrigin.from(allowOrigin);
        return this;
    }

    /**
     * Sets the `Access-Control-Allow-Private-Network` header.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Private-Network)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().allowPrivateNetwork(true);
     * ```
     */
    public allowPrivateNetwork(allowPrivateNetwork: AllowPrivateNetworkLike): this {
        this.allowPrivateNetwork_ = AllowPrivateNetwork.from(allowPrivateNetwork);
        return this;
    }

    /**
     * Sets the `Access-Control-Expose-Headers` header.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().exposeHeaders(["content-encoding"]);
     * ````
     *
     * All headers can be allowed with:
     *
     * @example
     * ```ts
     * import { CorsLayer, ANY } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().exposeHeaders(ANY);
     * ```
     */
    public exposeHeaders(exposeHeaders: ExposeHeadersLike): this {
        this.exposeHeaders_ = ExposeHeaders.from(exposeHeaders);
        return this;
    }

    /**
     * Sets the `Access-Control-Max-Age` header.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age)
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     *
     * const layer = CorsLayer.default().maxAge(600);
     * ```
     *
     * By default, the header will not be set which disables caching and will
     * require a preflight request for each request.
     *
     * Note that each browser has a maximum internal value that takes precedence
     * when the `Access-Control-Max-Age` header is greater.
     *
     * If you need more flexibility, you can supply a function which can
     * dynamically decide the max-age based on the origin and other parts of
     * each preflight request:
     *
     * @example
     * ```ts
     * import { CorsLayer } from "@taxum/core/middleware/cors";
     * import { MaxAge } from "@taxum/core/middleware/cors/max-age";
     *
     * const layer = CorsLayer.default().maxAge((origin, parts) => 600);
     * ```
     */
    public maxAge(maxAge: MaxAgeLike): this {
        this.maxAge_ = MaxAge.from(maxAge);
        return this;
    }

    /**
     * Sets the `Vary` header.
     *
     * In contrast to other headers, this one has a non-empty default of
     * {@link PREFLIGHT_REQUEST_HEADERS}.
     *
     * You only need to set this if you want to remove some of these defaults,
     * or if you use a function for one of the other headers and want to add a
     * `vary` header accordingly.
     *
     * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary)
     */
    public vary(vary: VaryLike): this {
        this.vary_ = Vary.from(vary);
        return this;
    }

    /**
     * @throws {@link !Error} if the CORS configuration is invalid.
     */
    public layer(inner: HttpService): HttpService {
        this.ensureUsableCorsRules();

        return new Cors(
            inner,
            this.allowCredentials_,
            this.allowHeaders_,
            this.allowMethods_,
            this.allowOrigin_,
            this.allowPrivateNetwork_,
            this.exposeHeaders_,
            this.maxAge_,
            this.vary_,
        );
    }

    private ensureUsableCorsRules(): void {
        if (!this.allowCredentials_.isTrue()) {
            return;
        }

        assert(
            !this.allowHeaders_.isWildcard(),
            "Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-headers: *`",
        );

        assert(
            !this.allowMethods_.isWildcard(),
            "Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-methods: *`",
        );

        assert(
            !this.allowOrigin_.isWildcard(),
            "Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-origin: *`",
        );

        assert(
            !this.exposeHeaders_.isWildcard(),
            "Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-expose-headers: *`",
        );
    }
}

class Cors implements HttpService {
    private readonly inner: HttpService;
    private readonly allowCredentials: AllowCredentials;
    private readonly allowHeaders: AllowHeaders;
    private readonly allowMethods: AllowMethods;
    private readonly allowOrigin: AllowOrigin;
    private readonly allowPrivateNetwork: AllowPrivateNetwork;
    private readonly exposeHeaders: ExposeHeaders;
    private readonly maxAge: MaxAge;
    private readonly vary: Vary;

    public constructor(
        inner: HttpService,
        allowCredentials: AllowCredentials,
        allowHeaders: AllowHeaders,
        allowMethods: AllowMethods,
        allowOrigin: AllowOrigin,
        allowPrivateNetwork: AllowPrivateNetwork,
        exposeHeaders: ExposeHeaders,
        maxAge: MaxAge,
        vary: Vary,
    ) {
        this.inner = inner;
        this.allowCredentials = allowCredentials;
        this.allowHeaders = allowHeaders;
        this.allowMethods = allowMethods;
        this.allowOrigin = allowOrigin;
        this.allowPrivateNetwork = allowPrivateNetwork;
        this.exposeHeaders = exposeHeaders;
        this.maxAge = maxAge;
        this.vary = vary;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const origin = req.head.headers.get("origin");

        const headers = new HeaderMap();
        headers.extend(maybeHeader(this.allowCredentials.toHeader(origin, req.head)));
        headers.extend(maybeHeader(this.allowPrivateNetwork.toHeader(origin, req.head)));
        headers.extend(maybeHeader(this.vary.toHeader()));

        const allowOriginPromise = this.allowOrigin.toHeader(origin, req.head);

        if (req.method.equals(Method.OPTIONS)) {
            headers.extend(maybeHeader(this.allowMethods.toHeader(req.head)));
            headers.extend(maybeHeader(this.allowHeaders.toHeader(req.head)));
            headers.extend(maybeHeader(this.maxAge.toHeader(origin, req.head)));
            headers.extend(maybeHeader(await allowOriginPromise));

            return HttpResponse.builder().headers(headers).body(null);
        }

        headers.extend(maybeHeader(this.exposeHeaders.toHeader()));

        const [res, allowOrigin] = await Promise.all([this.inner.invoke(req), allowOriginPromise]);
        headers.extend(maybeHeader(allowOrigin));
        const innerHeaders = res.headers;

        const vary = headers.remove("vary");

        if (vary) {
            innerHeaders.append("vary", vary);
        }

        innerHeaders.extend(headers);
        return new HttpResponse(res.status, innerHeaders, res.body);
    }
}

const maybeHeader = (entry: HeaderEntry | null): Iterable<HeaderEntry> => (entry ? [entry] : []);
