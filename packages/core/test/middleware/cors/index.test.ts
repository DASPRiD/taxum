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
    TO_HTTP_RESPONSE,
} from "../../../src/http/index.js";
import { ANY, CorsLayer } from "../../../src/middleware/cors/index.js";
import type { HttpService } from "../../../src/service/index.js";

describe("middleware:cors:index", () => {
    const dummyService: HttpService = {
        invoke: () => noContentResponse[TO_HTTP_RESPONSE](),
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
            const layer = new CorsLayer().allowCredentials(true).allowHeaders(ANY);

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-headers: \*`/);
        });

        it("allowCredentials cannot be combined with wildcard methods", () => {
            const layer = new CorsLayer().allowCredentials(true).allowMethods(ANY);

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-methods: \*`/);
        });

        it("allowCredentials cannot be combined with wildcard origin", () => {
            const layer = new CorsLayer().allowCredentials(true).allowOrigin(ANY);

            assert.throws(() => {
                layer.layer(dummyService);
            }, /Invalid CORS configuration: Cannot combine `access-control-allow-credentials: true` with `access-control-allow-origin: \*`/);
        });

        it("allowCredentials cannot be combined with wildcard expose", () => {
            const layer = new CorsLayer().allowCredentials(true).exposeHeaders(ANY);

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

        it("adds correct CORS headers on OPTIONS request", async () => {
            const cors = new CorsLayer()
                .allowMethods(ANY)
                .allowHeaders(ANY)
                .allowOrigin(ANY)
                .maxAge(60)
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

        it("adds CORS headers on non-OPTIONS request and merges vary header", async () => {
            const innerService = {
                invoke: async () => {
                    return HttpResponse.builder().header("vary", "Origin").body("body");
                },
            };

            const cors = new CorsLayer()
                .allowCredentials(true)
                .allowOrigin("https://example.com")
                .exposeHeaders(["X-Custom-Header"])
                .allowPrivateNetwork(true)
                .vary(["Accept-Encoding"])
                .layer(innerService);

            const req = makeRequest(Method.GET, "https://example.com");
            req.headers.insert("access-control-request-private-network", "true");

            const res = await cors.invoke(req);

            assert.equal(res.status, StatusCode.OK);
            assert.equal(await consumers.text(res.body.readable), "body");

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
