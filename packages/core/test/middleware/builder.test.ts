/** biome-ignore-all lint/complexity/useLiteralKeys: required for white-box tests */

import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { type HttpLayer, Identity, Stack } from "../../src/layer/index.js";
import { ServiceBuilder } from "../../src/middleware/builder.js";
import { FromFnLayer } from "../../src/middleware/from-fn.js";
import { type AnyService, serviceFn } from "../../src/service/index.js";
import { CatchErrorLayer, MapToHttpResponseLayer } from "../../src/util/index.js";

const assertInner = (
    builder: ServiceBuilder<AnyService, AnyService>,
    assertion: (inner: unknown) => void,
) => {
    const stack = builder["inner"] as unknown;
    assert(stack instanceof Stack);
    assert(stack["outer"] instanceof Identity);

    assertion(stack["inner"]);
};

describe("ServiceBuilder (white-box)", () => {
    it("create() returns builder with Identity layer", () => {
        const builder = ServiceBuilder.create();
        const inner = builder["inner"] as unknown;
        assert(inner instanceof Identity);
    });

    it("withLayer adds layer", () => {
        const builder = ServiceBuilder.create();
        const layer: HttpLayer = {
            layer: () => ({
                invoke: () => HttpResponse.builder().body(null),
            }),
        };

        assertInner(builder.withLayer(layer), (inner) => {
            assert.equal(inner, layer);
        });
    });

    it("withOptionLayer adds layer when set", () => {
        const builder = ServiceBuilder.create();
        const layer: HttpLayer = {
            layer: () => ({
                invoke: () => HttpResponse.builder().body(null),
            }),
        };

        assertInner(builder.withOptionLayer(layer), (inner) => {
            assert.equal(inner, layer);
        });
    });

    it("withOptionLayer adds identity when null", () => {
        const builder = ServiceBuilder.create();

        assertInner(builder.withOptionLayer(null), (inner) => {
            assert(inner instanceof Identity);
        });
    });

    it("withOptionLayer adds identity when undefined", () => {
        const builder = ServiceBuilder.create();

        assertInner(builder.withOptionLayer(undefined), (inner) => {
            assert(inner instanceof Identity);
        });
    });

    it("fromFn adds function in FromFnLayer", () => {
        const builder = ServiceBuilder.create();
        const fn = async (_req: HttpRequest) => HttpResponse.builder().body(null);

        assertInner(builder.fromFn(fn), (inner) => {
            assert(inner instanceof FromFnLayer);
        });
    });

    it("catchError adds CatchErrorLayer", () => {
        const builder = ServiceBuilder.create();

        assertInner(builder.catchError(), (inner) => {
            assert(inner instanceof CatchErrorLayer);
        });
    });

    it("mapToHttpResponse adds MapToHttpResponseLayer", () => {
        const builder = ServiceBuilder.create();

        assertInner(builder.mapToHttpResponse(), (inner) => {
            assert(inner instanceof MapToHttpResponseLayer);
        });
    });

    it("wraps service in right order", async () => {
        const builder = ServiceBuilder.create();

        const layerOne: HttpLayer = {
            layer: (inner) => ({
                invoke: async (req) => {
                    const res = await inner.invoke(req);
                    return HttpResponse.builder().body(
                        `1: ${await consumers.text(res.body.readable)}`,
                    );
                },
            }),
        };

        const layerTwo: HttpLayer = {
            layer: (inner) => ({
                invoke: async (req) => {
                    const res = await inner.invoke(req);
                    return HttpResponse.builder().body(
                        `2: ${await consumers.text(res.body.readable)}`,
                    );
                },
            }),
        };

        const service = serviceFn(() => {
            return HttpResponse.builder().body("0");
        });

        const res = HttpResponse.from(
            await builder
                .withLayer(layerOne)
                .withLayer(layerTwo)
                .layer(service)
                .invoke(HttpRequest.builder().body(null)),
        );
        const body = await consumers.text(res.body.readable);

        assert.equal(body, "1: 2: 0");
    });
});
