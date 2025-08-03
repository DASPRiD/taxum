/**
 * JWT support for taxum.
 *
 * This package supplies a JWT layer which can be used to verify incoming
 * HTTP requests to contain a valid JWT `Authorization` header.
 *
 * @see {@link jwtLayer}
 * @packageDocumentation
 */

import {
    ExtensionKey,
    type HttpRequest,
    HttpResponse,
    StatusCode,
    type ToHttpResponse,
} from "@taxum/core/http";
import type { Layer } from "@taxum/core/routing";
import {
    type CryptoKey,
    type JWK,
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
 * Configuration options for handling JSON Web Tokens (JWTs).
 */
export type JwtConfig = {
    /**
     * Key used for verifying incoming JWTs.
     */
    key: CryptoKey | KeyObject | JWK | Uint8Array;

    /**
     * Options used to verify JWTs.
     */
    verifyOptions?: JWTVerifyOptions | (() => JWTVerifyOptions);

    /**
     * Whether to allow unauthorized users to pass through.
     */
    allowUnauthorized?: boolean;

    /**
     * When enabled, the HTTP response will contain concrete error information.
     *
     * You should **not** enable this in production!
     */
    debug?: boolean;
};

/**
 * Layer to validate incoming JWTs.
 *
 * If verification succeeds, the decoded JWT is stored in the request's extensions
 * under the {@link JWT} key.
 *
 * See {@link JwtConfig} for configuration.
 *
 * @example
 * ```ts
 * import {jwtLayer} from "@taxum/jwt";
 * import {m, Router} from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/" m.get(() => "I'm protected!"))
 *     .layer(jwtLayer({
 *         key: new Uint8Array(),
 *     ));
 *
 * ```
 */
export const jwtLayer = (config: JwtConfig): Layer => {
    const resolveJwt = async (req: HttpRequest): Promise<JWTVerifyResult | UnauthorizedError> => {
        const authorization = req.headers.get("authorization");

        if (!authorization) {
            return new UnauthorizedError("Missing authorization header", config?.debug ?? false);
        }

        const parts = authorization.split(" ");

        if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
            return new UnauthorizedError("Malformed authorization header", config?.debug ?? false);
        }

        const verifyOptions =
            typeof config.verifyOptions === "function"
                ? config.verifyOptions()
                : config.verifyOptions;

        try {
            return jwtVerify(parts[1], config.key, verifyOptions);
        } catch (error) {
            return new UnauthorizedError(
                /* node:coverage ignore next */
                error instanceof Error ? error.message : "Invalid JWT",
                config?.debug ?? false,
            );
        }
    };

    return {
        layer: (inner) => async (req) => {
            const jwtOrError = await resolveJwt(req);

            if (jwtOrError instanceof UnauthorizedError) {
                return config?.allowUnauthorized ? inner(req) : jwtOrError.toHttpResponse();
            }

            req.extensions.insert(JWT, jwtOrError);
            return inner(req);
        },
    };
};

export class UnauthorizedError implements ToHttpResponse {
    public readonly reason: string;
    public readonly expose: boolean;

    public constructor(reason: string, expose: boolean) {
        this.reason = reason;
        this.expose = expose;
    }

    public toHttpResponse(): HttpResponse {
        return HttpResponse.builder()
            .status(StatusCode.UNAUTHORIZED)
            .body(this.expose ? this.reason : null);
    }
}
