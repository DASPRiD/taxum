/** biome-ignore-all lint/complexity/useLiteralKeys: required for simple black-box tests */

import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import {
    HeaderMap,
    HttpRequest,
    HttpResponse,
    Method,
    noContentResponse,
    StatusCode,
} from "../../../src/http/index.js";
import {
    AllowCredentials,
    AllowHeaders,
    AllowMethods,
    AllowOrigin,
    AllowPrivateNetwork,
    CorsLayer,
    ExposeHeaders,
    MaxAge,
    Vary,
} from "../../../src/layer/cors/index.js";
import type { Service } from "../../../src/routing/index.js";

describe("layer:cors:index", () => {
    const dummyService: Service = {
        invoke: () => noContentResponse.toHttpResponse(),
    };

    describe("CorsLayer", () => {
        it("permissive preset sets expected defaults", () => {
            const layer = CorsLayer.permissive();

            assert(layer["allowHeaders_"].isWildcard());
            assert(layer["allowMethods_"].isWildcard());
            assert(layer["allowOrigin_"].isWildcard());
            assert(layer["exposeHeaders_"].isWildcard());
            assert(!layer["allowCredentials_"].isTrue());
        });

        it("veryPermissive preset sets expected defaults", () => {
            const layer = CorsLayer.veryPermissive();

            assert(layer["allowCredentials_"].isTrue());
        });

        it("allowCredentials cannot be combined with wildcard headers", () => {
            const layer = new CorsLayer()
                .allowCredentials(AllowCredentials.yes())
                .allowHeaders(AllowHeaders.any());

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-headers: \*`/);
        });

        it("allowCredentials cannot be combined with wildcard methods", () => {
            const layer = new CorsLayer()
                .allowCredentials(AllowCredentials.yes())
                .allowMethods(AllowMethods.any());

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-methods: \*`/);
        });

        it("allowCredentials cannot be combined with wildcard origin", () => {
            const layer = new CorsLayer()
                .allowCredentials(AllowCredentials.yes())
                .allowOrigin(AllowOrigin.any());

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-origin: \*`/);
        });

        it("allowCredentials cannot be combined with wildcard expose", () => {
            const layer = new CorsLayer()
                .allowCredentials(AllowCredentials.yes())
                .exposeHeaders(ExposeHeaders.any());

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-expose-headers: \*`/);
        });
    });

    describe("Cors", () => {
        const makeRequest = (
            method: Method,
            origin: string | null,
            headers: Record<string, string> = {},
        ) => {
            const headerMap = new HeaderMap();

            if (origin) {
                headerMap.insert("origin", origin);
            }

            for (const [k, v] of Object.entries(headers)) {
                headerMap.insert(k.toLowerCase(), v);
            }

            return HttpRequest.builder().method(method).headers(headerMap).body(null);
        };

        it.only("adds correct CORS headers on OPTIONS request", async () => {
            const cors = new CorsLayer()
                .allowMethods(AllowMethods.any())
                .allowHeaders(AllowHeaders.any())
                .allowOrigin(AllowOrigin.any())
                .maxAge(MaxAge.exact(60))
                .layer(dummyService);

            const req = makeRequest(Method.OPTIONS, "https://example.com", {
                "access-control-request-method": "GET",
                "access-control-request-headers": "X-Test",
            });

            const res = await cors.invoke(req);

            assert.equal(res.status, StatusCode.OK);
            assert.equal(res.headers.get("access-control-allow-methods"), "*");
            assert.equal(res.headers.get("access-control-allow-headers"), "*");
            assert.equal(res.headers.get("access-control-allow-origin"), "*");
            assert.equal(res.headers.get("access-control-allow-credentials"), null);
            assert.equal(res.headers.get("access-control-max-age"), "60");
            assert.equal(
                res.headers.get("vary"),
                "origin, access-control-request-method, access-control-request-headers",
            );
        });

        it.only("adds CORS headers on non-OPTIONS request and merges vary header", async () => {
            const innerService = {
                invoke: async () => {
                    return HttpResponse.builder().header("vary", "Origin").body("body");
                },
            };

            const cors = new CorsLayer()
                .allowCredentials(AllowCredentials.yes())
                .allowOrigin(AllowOrigin.exact("https://example.com"))
                .exposeHeaders(ExposeHeaders.list(["X-Custom-Header"]))
                .allowPrivateNetwork(AllowPrivateNetwork.yes())
                .vary(Vary.list(["Accept-Encoding"]))
                .layer(innerService);

            const req = makeRequest(Method.GET, "https://example.com");
            req.headers.insert("access-control-request-private-network", "true");

            const res = await cors.invoke(req);

            assert.equal(res.status, StatusCode.OK);
            assert.equal(await consumers.text(res.body.read()), "body");

            const varyHeaders = res.headers.getAll("vary");

            assert(varyHeaders.includes("Origin"));
            assert(varyHeaders.includes("Accept-Encoding"));

            assert.equal(res.headers.get("access-control-allow-private-network"), "true");
            assert.equal(res.headers.get("access-control-expose-headers"), "X-Custom-Header");
            assert.equal(res.headers.get("access-control-allow-credentials"), "true");
            assert.equal(res.headers.get("access-control-allow-origin"), "https://example.com");
        });
    });
});
