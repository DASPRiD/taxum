import assert from "node:assert";
import { HeaderMap, type HttpRequest, HttpResponse, Method } from "../../http/index.js";
import type { Layer, Service } from "../../routing/index.js";
import { AllowCredentials } from "./allow-credentials.js";
import { AllowHeaders } from "./allow-headers.js";
import { AllowMethods } from "./allow-methods.js";
import { AllowOrigin } from "./allow-origin.js";
import { AllowPrivateNetwork } from "./allow-private-network.js";
import { ExposeHeaders } from "./expose-headers.js";
import { MaxAge } from "./max-age.js";
import { Vary } from "./vary.js";

export * from "./allow-credentials.js";
export * from "./allow-headers.js";
export * from "./allow-methods.js";
export * from "./allow-origin.js";
export * from "./allow-private-network.js";
export * from "./expose-headers.js";
export * from "./max-age.js";
export * from "./vary.js";

/**
 * A layer that sets CORS headers on the response.
 *
 * @example
 * ```ts
 * import { CorsLayer } from "@taxum/core/layer/cors";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(CorsLayer.permissive());
 * ```
 */
export class CorsLayer implements Layer {
    private allowCredentials_ = AllowCredentials.default();
    private allowHeaders_ = AllowHeaders.default();
    private allowMethods_ = AllowMethods.default();
    private allowOrigin_ = AllowOrigin.default();
    private allowPrivateNetwork_ = AllowPrivateNetwork.default();
    private exposeHeaders_ = ExposeHeaders.default();
    private maxAge_ = MaxAge.default();
    private vary_ = Vary.default();

    public static permissive(): CorsLayer {
        return new CorsLayer()
            .allowHeaders(AllowHeaders.any())
            .allowMethods(AllowMethods.any())
            .allowOrigin(AllowOrigin.any())
            .exposeHeaders(ExposeHeaders.any());
    }

    public static veryPermissive(): CorsLayer {
        return new CorsLayer()
            .allowCredentials(AllowCredentials.yes())
            .allowHeaders(AllowHeaders.mirrorRequest())
            .allowMethods(AllowMethods.mirrorRequest())
            .allowOrigin(AllowOrigin.mirrorRequest());
    }

    public allowCredentials(allowCredentials: AllowCredentials): this {
        this.allowCredentials_ = allowCredentials;
        return this;
    }

    public allowHeaders(allowHeaders: AllowHeaders): this {
        this.allowHeaders_ = allowHeaders;
        return this;
    }

    public allowMethods(allowMethods: AllowMethods): this {
        this.allowMethods_ = allowMethods;
        return this;
    }

    public allowOrigin(allowOrigin: AllowOrigin): this {
        this.allowOrigin_ = allowOrigin;
        return this;
    }

    public allowPrivateNetwork(allowPrivateNetwork: AllowPrivateNetwork): this {
        this.allowPrivateNetwork_ = allowPrivateNetwork;
        return this;
    }

    public exposeHeaders(exposeHeaders: ExposeHeaders): this {
        this.exposeHeaders_ = exposeHeaders;
        return this;
    }

    public maxAge(maxAge: MaxAge): this {
        this.maxAge_ = maxAge;
        return this;
    }

    public vary(vary: Vary): this {
        this.vary_ = vary;
        return this;
    }

    public layer(inner: Service): Service {
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

class Cors implements Service {
    private readonly inner: Service;
    private readonly allowCredentials: AllowCredentials;
    private readonly allowHeaders: AllowHeaders;
    private readonly allowMethods: AllowMethods;
    private readonly allowOrigin: AllowOrigin;
    private readonly allowPrivateNetwork: AllowPrivateNetwork;
    private readonly exposeHeaders: ExposeHeaders;
    private readonly maxAge: MaxAge;
    private readonly vary: Vary;

    public constructor(
        inner: Service,
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

const maybeHeader = (item: [string, string] | null): Iterable<[string, string]> =>
    item ? [item] : [];
