import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it, mock } from "node:test";
import {
    HttpRequest,
    HttpResponse,
    type HttpResponseLike,
    StatusCode,
} from "../../src/http/index.js";
import {
    type ErrorHandler,
    type Handler,
    type Layer,
    MethodRouter,
    m,
    Router,
    type Service,
} from "../../src/routing/index.js";

describe("routing:Router", () => {
    it("routes a request to a matching method handler", async () => {
        const router = new Router();
        const methodRouter = MethodRouter.default().get(() => "hello");

        router.route("/greet", methodRouter);

        const req = HttpRequest.builder().method("GET").path("/greet").body(null);
        const res = await router.invoke(req);

        assert.equal(res.status.code, 200);
        assert.equal(await consumers.text(res.body.read()), "hello");
    });

    it("returns 404 for unmatched routes", async () => {
        const router = new Router();

        const req = HttpRequest.builder().method("GET").path("/missing").body(null);
        const res = await router.invoke(req);

        assert.equal(res.status.code, 404);
    });

    it("uses fallback when no route matches", async () => {
        const router = new Router();
        router.fallback(() => HttpResponse.builder().status(StatusCode.IM_A_TEAPOT).body("oops"));

        const req = HttpRequest.builder().method("GET").path("/unknown").body(null);
        const res = await router.invoke(req);

        assert.equal(res.status.code, 418);
        assert.equal(await consumers.text(res.body.read()), "oops");
    });

    it("can reset fallback to default", async () => {
        const router = new Router();
        router.fallback(() => StatusCode.NO_CONTENT);
        router.resetFallback();

        const req = HttpRequest.builder().method("GET").path("/nope").body(null);
        const res = await router.invoke(req);

        assert.equal(res.status.code, 404);
    });

    it("applies layer to all routes and fallback", async () => {
        const logs: string[] = [];

        const loggingLayer: Layer = {
            layer: (inner) => ({
                invoke: (req) => {
                    logs.push(req.uri.pathname);
                    return inner.invoke(req);
                },
            }),
        };

        const router = new Router();
        router.route(
            "/test",
            MethodRouter.default().get(() => "works"),
        );
        router.fallback(() => "fallback");
        router.layer(loggingLayer);

        const res1 = await router.invoke(
            HttpRequest.builder().method("GET").path("/test").body(null),
        );
        const res2 = await router.invoke(
            HttpRequest.builder().method("GET").path("/not-found").body(null),
        );

        assert.equal(await consumers.text(res1.body.read()), "works");
        assert.equal(await consumers.text(res2.body.read()), "fallback");
        assert.deepEqual(logs, ["/test", "/not-found"]);
    });

    it("applies a layer to all routes", async () => {
        const logs: string[] = [];

        const loggingLayer: Layer = {
            layer: (inner) => ({
                invoke: (req) => {
                    logs.push(req.uri.pathname);
                    return inner.invoke(req);
                },
            }),
        };

        const router = new Router();
        router.route(
            "/test",
            MethodRouter.default().get(() => "works"),
        );
        router.fallback(() => "fallback");
        router.routeLayer(loggingLayer);

        const res1 = await router.invoke(
            HttpRequest.builder().method("GET").path("/test").body(null),
        );
        const res2 = await router.invoke(
            HttpRequest.builder().method("GET").path("/not-found").body(null),
        );

        assert.equal(await consumers.text(res1.body.read()), "works");
        assert.equal(await consumers.text(res2.body.read()), "fallback");
        assert.deepEqual(logs, ["/test"]);
    });

    it("can nest sub-routers", async () => {
        const sub = new Router();
        sub.route(
            "/inner",
            MethodRouter.default().get(() => "inside"),
        );

        const main = new Router();
        main.nest("/api", sub);

        const req = HttpRequest.builder().method("GET").path("/api/inner").body(null);
        const res = await main.invoke(req);

        assert.equal(await consumers.text(res.body.read()), "inside");
    });

    it("can nest services", async () => {
        const nestedService: Service<HttpResponseLike> = {
            invoke: async () => "nested response",
        };

        const router = new Router();
        router.nestService("/nested", nestedService);

        const req = HttpRequest.builder().method("GET").path("/nested").body(null);
        const res = await router.invoke(req);

        assert.equal(res.status.code, 200);
        assert.equal(await consumers.text(res.body.read()), "nested response");
    });

    it("calls methodNotAllowedFallback when method is unsupported but path exists", async () => {
        const helloHandler = mock.fn<Handler>(() => "hello");
        const handle404 = mock.fn<Handler>(() => [404, "hello"]);
        const handle405 = mock.fn<Handler>(() => [405, "method not allowed"]);

        const router = new Router()
            .route("/test", m.get(helloHandler))
            .fallback(handle404)
            .methodNotAllowedFallback(handle405);

        const res1 = await router.invoke(HttpRequest.builder().path("/test").body(null));
        assert.equal(res1.status, StatusCode.OK);
        assert.equal(helloHandler.mock.callCount(), 1);
        assert.equal(handle404.mock.callCount(), 0);
        assert.equal(handle405.mock.callCount(), 0);

        const res2 = await router.invoke(
            HttpRequest.builder().method("POST").path("/test").body(null),
        );
        assert.equal(res2.status, StatusCode.METHOD_NOT_ALLOWED);
        assert.equal(handle405.mock.callCount(), 1);

        const res3 = await router.invoke(
            HttpRequest.builder().method("GET").path("/foo").body(null),
        );
        assert.equal(res3.status, StatusCode.NOT_FOUND);
        assert.equal(handle404.mock.callCount(), 1);
    });

    it("allow overriding the error handler", async () => {
        const errorHandler: ErrorHandler = () =>
            HttpResponse.builder().status(StatusCode.NOT_FOUND).body("not found");

        const router = new Router()
            .route(
                "/test",
                m.get(() => {
                    throw StatusCode.UNPROCESSABLE_CONTENT;
                }),
            )
            .errorHandler(errorHandler);

        const res = await router.invoke(HttpRequest.builder().path("/test").body(null));
        assert.equal(res.status, StatusCode.NOT_FOUND);
    });
});
