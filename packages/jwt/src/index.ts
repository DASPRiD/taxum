/**
 * JWT support for taxum.
 *
 * This package supplies a JWT layer which can be used to verify incoming
 * HTTP requests to contain a valid JWT `Authorization` header.
 *
 * @see {@link JwtLayer}
 * @packageDocumentation
 */

import { ExtensionKey, type HttpRequest, type HttpResponse, StatusCode } from "@taxum/core/http";
import type { HttpLayer } from "@taxum/core/layer";
import type { HttpService } from "@taxum/core/service";
import { ClientError } from "@taxum/core/util";
import {
    type CryptoKey,
    type JWK,
    type JWTVerifyGetKey,
    type JWTVerifyOptions,
    type JWTVerifyResult,
    jwtVerify,
    type KeyObject,
} from "jose";

/**
 * Key under which the verified JWT result is stored in request extensions.
 */
export const JWT = new ExtensionKey<JWTVerifyResult>("JWT");

/**
 * A layer to validate incoming JWTs.
 *
 * If verification succeeds, the decoded JWT is stored in the request's
 * extensions under the {@link JWT} key.
 *
 * The service will throw an {@link UnauthorizedError} if the JWT is missing or
 * is not valid, unless `allowUnauthorized` is set to `true`.
 *
 * @example
 * ```ts
 * import {JwtLayer} from "@taxum/jwt";
 * import {m, Router} from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/" m.get(() => "I'm protected!"))
 *     .layer(new JwtLayer(new Uint8Array());
 * ```
 *
 * @see [jose](https://github.com/panva/jose)
 */
export class JwtLayer implements HttpLayer {
    private readonly key: CryptoKey | KeyObject | JWK | Uint8Array | JWTVerifyGetKey;
    private verifyOptions_: JWTVerifyOptions | (() => JWTVerifyOptions) | undefined;
    private allowUnauthorized_: boolean;
    private debug_: boolean;

    /**
     * Creates a new {@link JwtLayer}.
     *
     * @see [jose](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md)
     */
    public constructor(key: CryptoKey | KeyObject | JWK | Uint8Array | JWTVerifyGetKey) {
        this.key = key;
        this.verifyOptions_ = undefined;
        this.allowUnauthorized_ = false;
        this.debug_ = false;
    }

    /**
     * Sets the verify options.
     *
     * The options can either be static options or a function which returns the
     * options.
     *
     * @see [JWTVerifyOptions](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md)
     */
    public verifyOptions(verifyOptions: JWTVerifyOptions | (() => JWTVerifyOptions)): this {
        this.verifyOptions_ = verifyOptions;
        return this;
    }

    /**
     * Sets whether to allow unauthorized requests.
     *
     * If set to `true`, unauthorized requests will be passed through to the
     * inner service without setting the {@link JWT} extension.
     */
    public allowUnauthorized(allow: boolean): this {
        this.allowUnauthorized_ = allow;
        return this;
    }

    /**
     * Sets whether to expose error details in the response body.
     *
     * This can be helpful to debug issues with the configuration, but
     * **must not** be enabled in production!
     */
    public debug(enabled: boolean): this {
        this.debug_ = enabled;
        return this;
    }

    public layer(inner: HttpService): HttpService {
        return new Jwt(inner, this.key, this.verifyOptions_, this.allowUnauthorized_, this.debug_);
    }
}

class Jwt implements HttpService {
    private readonly inner: HttpService;
    private readonly key: CryptoKey | KeyObject | JWK | Uint8Array | JWTVerifyGetKey;
    private readonly verifyOptions: JWTVerifyOptions | (() => JWTVerifyOptions) | undefined;
    private readonly allowUnauthorized: boolean;
    private readonly debug: boolean;

    public constructor(
        inner: HttpService,
        key: CryptoKey | KeyObject | JWK | Uint8Array | JWTVerifyGetKey,
        verifyOptions: JWTVerifyOptions | (() => JWTVerifyOptions) | undefined,
        allowUnauthorized: boolean,
        debug: boolean,
    ) {
        this.inner = inner;
        this.key = key;
        this.verifyOptions = verifyOptions;
        this.allowUnauthorized = allowUnauthorized;
        this.debug = debug;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const jwtOrError = await this.resolveJwt(req);

        if (jwtOrError instanceof UnauthorizedError) {
            if (this.allowUnauthorized) {
                return this.inner.invoke(req);
            }

            throw jwtOrError;
        }

        req.extensions.insert(JWT, jwtOrError);
        return this.inner.invoke(req);
    }

    private async resolveJwt(req: HttpRequest): Promise<JWTVerifyResult | UnauthorizedError> {
        const authorization = req.headers.get("authorization");

        if (!authorization) {
            return new UnauthorizedError("Missing authorization header", this.debug);
        }

        const parts = authorization.value.split(" ");

        if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
            return new UnauthorizedError("Malformed authorization header", this.debug);
        }

        const verifyOptions =
            typeof this.verifyOptions === "function" ? this.verifyOptions() : this.verifyOptions;

        try {
            return await jwtVerify(
                parts[1],
                this.key as Parameters<typeof jwtVerify>[1],
                verifyOptions,
            );
        } catch (error) {
            return new UnauthorizedError(
                /* node:coverage ignore next */
                error instanceof Error ? error.message : "Invalid JWT",
                this.debug,
            );
        }
    }
}

/**
 * Error thrown when the JWT is missing or invalid.
 */
export class UnauthorizedError extends ClientError {
    public readonly debugReason: string;

    public constructor(reason: string, expose: boolean) {
        super(
            StatusCode.UNAUTHORIZED,
            expose ? `Authentication required: ${reason}` : "Authentication required",
        );

        this.debugReason = reason;
    }
}
