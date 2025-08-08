import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
    type HttpRequest,
    HttpResponse,
    noContentResponse,
    StatusCode,
} from "../../src/http/index.js";
import type { Router, Service } from "../../src/routing/index.js";
import { type ServeConfig, serve } from "../../src/server/index.js";

class MockRouter {
    private readonly service: Service;

    public constructor(service: Service) {
        this.service = service;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        return this.service.invoke(req);
    }
}

const makeMockRouter = (service: Service): Router => {
    return new MockRouter(service) as unknown as Router;
};

describe("server:index", () => {
    describe("serve", () => {
        afterEach(() => {
            process.removeAllListeners("SIGINT");
            process.removeAllListeners("SIGQUIT");
            process.removeAllListeners("SIGTERM");
        });

        it("responds with a successful response from router", async () => {
            const router = makeMockRouter({ invoke: () => HttpResponse.builder().body(null) });
            const controller = new AbortController();

            const config: ServeConfig = {
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    assert(response.status === 200);
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(router, config);
        });

        it("handles router error with toHttpResponse", async () => {
            const router = makeMockRouter({
                invoke: () => {
                    throw StatusCode.IM_A_TEAPOT;
                },
            });
            const controller = new AbortController();

            const config: ServeConfig = {
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    assert(response.status === 418);
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(router, config);
        });

        it("handles uncaught errors with 500", async (t) => {
            const spy = t.mock.method(console, "error", () => {
                // Suppress actual console.error output.
            });

            const router = makeMockRouter({
                invoke: () => {
                    throw new Error("boom");
                },
            });
            const controller = new AbortController();

            const config: ServeConfig = {
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    assert(response.status === 500);
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(router, config);
            assert.match(spy.mock.calls[0].arguments[0], /Uncaught error in request handler/i);
        });

        it("calls onListen with address info", async () => {
            let listenCalled = false;
            const router = makeMockRouter({ invoke: () => noContentResponse.toHttpResponse() });
            const controller = new AbortController();

            const config: ServeConfig = {
                onListen: (address) => {
                    assert.ok(address.port);
                    listenCalled = true;
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(router, config);
            assert.ok(listenCalled);
        });

        it("unrefs server when unrefOnStart is true", async () => {
            const router = makeMockRouter({ invoke: () => noContentResponse.toHttpResponse() });
            const controller = new AbortController();

            const config: ServeConfig = {
                unrefOnStart: true,
                onListen: () => controller.abort(),
                abortSignal: controller.signal,
            };

            await serve(router, config);
        });

        it("shuts down via abortSignal", async () => {
            const router = makeMockRouter({ invoke: () => noContentResponse.toHttpResponse() });
            const controller = new AbortController();

            const config: ServeConfig = {
                abortSignal: controller.signal,
                onListen: () => {
                    controller.abort();
                },
            };

            await serve(router, config);
        });

        it("shuts down after shutdownTimeout", async (t) => {
            const router = makeMockRouter({
                invoke: () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(noContentResponse.toHttpResponse()), 2000),
                    ),
            });
            const controller = new AbortController();
            t.mock.timers.enable({ apis: ["setTimeout"] });

            const config: ServeConfig = {
                shutdownTimeout: 1000,
                onListen: () => {
                    controller.abort();
                    t.mock.timers.tick(1000);
                },
                abortSignal: controller.signal,
            };

            await serve(router, config);
        });

        it("handles Ctrl+C signals if catchCtrlC is true", async () => {
            const router = makeMockRouter({ invoke: () => noContentResponse.toHttpResponse() });
            const controller = new AbortController();

            const config: ServeConfig = {
                catchCtrlC: true,
                onListen: () => {
                    process.emit("SIGINT");
                },
                abortSignal: controller.signal,
            };

            await serve(router, config);
        });
    });
});
