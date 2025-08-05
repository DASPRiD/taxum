import assert from "node:assert";
import { HeaderMap } from "../../http/headers.js";
import { HttpResponse } from "../../http/index.js";
import { Method } from "../../http/method.js";
import type { Layer } from "../../routing/index.js";
import type { ServiceFn } from "../../routing/service.js";
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

    public layer(inner: ServiceFn): ServiceFn {
        this.ensureUsableCorsRules();

        return async (req) => {
            const origin = req.head.headers.get("origin");

            const headers = new HeaderMap();
            headers.extend(maybeHeader(this.allowCredentials_.toHeader(origin, req.head)));
            headers.extend(maybeHeader(this.allowPrivateNetwork_.toHeader(origin, req.head)));
            headers.extend(maybeHeader(this.vary_.toHeader()));

            const allowOriginPromise = this.allowOrigin_.toHeader(origin, req.head);

            if (req.method.equals(Method.OPTIONS)) {
                headers.extend(maybeHeader(this.allowMethods_.toHeader(req.head)));
                headers.extend(maybeHeader(this.allowHeaders_.toHeader(req.head)));
                headers.extend(maybeHeader(this.maxAge_.toHeader(origin, req.head)));
                headers.extend(maybeHeader(await allowOriginPromise));

                return HttpResponse.builder().headers(headers).body(null);
            }

            headers.extend(maybeHeader(this.exposeHeaders_.toHeader()));

            const [response, allowOrigin] = await Promise.all([inner(req), allowOriginPromise]);
            headers.extend(maybeHeader(allowOrigin));
            const responseHeaders = response.headers.toOwned();

            const vary = headers.remove("vary");

            if (vary) {
                responseHeaders.append("vary", vary);
            }

            responseHeaders.extend(headers);
            return new HttpResponse(response.status, responseHeaders, response.body);
        };
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

const maybeHeader = (item: [string, string] | null): Iterable<[string, string]> =>
    item ? [item] : [];
