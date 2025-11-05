import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { HttpResponse, noContentResponse, TO_HTTP_RESPONSE } from "../../src/http/index.js";
import { type ServeConfig, serve } from "../../src/server/index.js";
import type { HttpService } from "../../src/service/index.js";

const makeMockService = (f: () => Promise<HttpResponse> | HttpResponse): HttpService => ({
    invoke: f,
});

describe("server:index", () => {
    describe("serve", () => {
        afterEach(() => {
            process.removeAllListeners("SIGINT");
            process.removeAllListeners("SIGQUIT");
            process.removeAllListeners("SIGTERM");
        });

        it("responds with a successful response from router", async () => {
            const service = makeMockService(() => HttpResponse.builder().body(null));
            const controller = new AbortController();

            const config: ServeConfig = {
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    assert(response.status === 200);
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(service, config);
        });

        it("handles uncaught errors with 500", async (t) => {
            const spy = t.mock.method(console, "error", () => {
                // Suppress actual console.error output.
            });

            const service = makeMockService(() => {
                throw new Error("boom");
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

            await serve(service, config);
            assert.match(spy.mock.calls[0].arguments[0], /Uncaught error in router/i);
        });

        it("handles malformed request", async () => {
            const service = makeMockService(() => {
                throw new Error("Should not be called");
            });
            const controller = new AbortController();

            const config: ServeConfig = {
                trustProxy: true,
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`, {
                        headers: {
                            "x-forwarded-host": "invalid@host",
                        },
                    });
                    assert(response.status === 400);
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(service, config);
        });

        it("calls onListen with address info", async () => {
            let listenCalled = false;
            const service = makeMockService(() => noContentResponse[TO_HTTP_RESPONSE]());
            const controller = new AbortController();

            const config: ServeConfig = {
                onListen: (address) => {
                    assert.ok(address.port);
                    listenCalled = true;
                    controller.abort();
                },
                abortSignal: controller.signal,
            };

            await serve(service, config);
            assert.ok(listenCalled);
        });

        it("unrefs server when unrefOnStart is true", async () => {
            const service = makeMockService(() => noContentResponse[TO_HTTP_RESPONSE]());
            const controller = new AbortController();

            const config: ServeConfig = {
                unrefOnStart: true,
                onListen: () => controller.abort(),
                abortSignal: controller.signal,
            };

            await serve(service, config);
        });

        it("shuts down via abortSignal", async () => {
            const service = makeMockService(() => noContentResponse[TO_HTTP_RESPONSE]());
            const controller = new AbortController();

            const config: ServeConfig = {
                abortSignal: controller.signal,
                onListen: () => {
                    controller.abort();
                },
            };

            await serve(service, config);
        });

        it("shuts down after shutdownTimeout", async (t) => {
            const service = makeMockService(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(noContentResponse[TO_HTTP_RESPONSE]()), 2000),
                    ),
            );
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

            await serve(service, config);
        });

        it("handles Ctrl+C signals if catchCtrlC is true", async () => {
            const service = makeMockService(() => noContentResponse[TO_HTTP_RESPONSE]());
            const controller = new AbortController();

            const config: ServeConfig = {
                catchCtrlC: true,
                onListen: () => {
                    process.emit("SIGINT");
                },
                abortSignal: controller.signal,
            };

            await serve(service, config);
        });
    });
});
