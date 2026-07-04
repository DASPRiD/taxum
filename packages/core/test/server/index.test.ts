import assert from "node:assert/strict";
import net from "node:net";
import { afterEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
    Body,
    HeaderMap,
    type HttpRequest,
    HttpResponse,
    noContentResponse,
    StatusCode,
    TO_HTTP_RESPONSE,
} from "../../src/http/index.js";
import {
    DISCONNECT_SIGNAL,
    type ServeConfig,
    SHUTDOWN_SIGNAL,
    serve,
} from "../../src/server/index.js";
import type { HttpService } from "../../src/service/index.js";

const makeMockService = (
    f: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse,
): HttpService => ({
    invoke: f,
});

const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    const timer = new AbortController();

    try {
        return await Promise.race([
            promise,
            delay(ms, undefined, { signal: timer.signal }).then(() => {
                throw new Error(message);
            }),
        ]);
    } finally {
        timer.abort();
    }
};

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

        it("force-closes streaming connections at the shutdown deadline", async () => {
            const encoder = new TextEncoder();

            const { promise: streamCancellation, resolve: streamCancelled } =
                Promise.withResolvers<void>();

            async function* endlessChunks(): AsyncGenerator<Uint8Array> {
                try {
                    while (true) {
                        yield encoder.encode("data: ping\n\n");
                        await delay(20);
                    }
                } finally {
                    streamCancelled();
                }
            }

            const service = makeMockService(
                () =>
                    new HttpResponse(
                        StatusCode.OK,
                        new HeaderMap(),
                        new Body(ReadableStream.from(endlessChunks())),
                    ),
            );

            const controller = new AbortController();
            let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

            const { promise: clientConnectionEnded, resolve: clientSawEnd } =
                Promise.withResolvers<void>();

            const config: ServeConfig = {
                shutdownTimeout: 200,
                abortSignal: controller.signal,
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    reader = response.body?.getReader();
                    await reader?.read();
                    controller.abort();

                    try {
                        while (!((await reader?.read())?.done ?? true)) {
                            // Drain until the server terminates the connection.
                        }
                    } catch {
                        // An abrupt termination is fine as well.
                    }

                    clientSawEnd();
                },
            };

            try {
                await withTimeout(serve(service, config), 2000, "serve() did not resolve");
                await withTimeout(
                    streamCancellation,
                    1000,
                    "body stream was not cancelled at the shutdown deadline",
                );
                await withTimeout(
                    clientConnectionEnded,
                    1000,
                    "client connection was not terminated at the shutdown deadline",
                );
            } finally {
                await reader?.cancel().catch(() => undefined);
            }
        });

        it("marks in-flight responses with connection: close during shutdown", async () => {
            const { promise: handlerStart, resolve: handlerStarted } =
                Promise.withResolvers<void>();
            const { promise: handlerRelease, resolve: releaseHandler } =
                Promise.withResolvers<void>();

            const service = makeMockService(async () => {
                handlerStarted();
                await handlerRelease;
                return HttpResponse.builder().body("done");
            });

            const controller = new AbortController();
            let socket: net.Socket | undefined;
            let rawResponse = "";

            const { promise: socketEnd, resolve: socketEnded } = Promise.withResolvers<void>();

            const config: ServeConfig = {
                abortSignal: controller.signal,
                onListen: async ({ port }) => {
                    socket = net.connect(port, "localhost");

                    socket.on("data", (chunk) => {
                        rawResponse += chunk.toString();
                    });

                    socket.on("end", () => {
                        socketEnded();
                    });

                    socket.write("GET / HTTP/1.1\r\nhost: localhost\r\n\r\n");
                    await handlerStart;
                    controller.abort();
                    releaseHandler();
                },
            };

            try {
                await withTimeout(serve(service, config), 2000, "serve() did not resolve");
                await withTimeout(
                    socketEnd,
                    1000,
                    "socket was not closed after the in-flight response finished",
                );

                assert.match(rawResponse, /^connection: close$/im);
            } finally {
                socket?.destroy();
            }
        });

        it("stops serving kept-alive sockets whose response headers predate shutdown", async () => {
            const encoder = new TextEncoder();

            const { promise: bodyRelease, resolve: releaseBody } = Promise.withResolvers<void>();

            const service = makeMockService(
                () =>
                    new HttpResponse(
                        StatusCode.OK,
                        new HeaderMap(),
                        new Body(
                            new ReadableStream({
                                start: async (streamController) => {
                                    streamController.enqueue(encoder.encode("hello"));
                                    await bodyRelease;
                                    streamController.close();
                                },
                            }),
                        ),
                    ),
            );

            const controller = new AbortController();
            let socket: net.Socket | undefined;
            let responseData = "";
            let firstResponseDone = false;
            let dataAfterFirstResponse = false;

            const { promise: socketEnd, resolve: socketEnded } = Promise.withResolvers<void>();
            const { promise: firstChunk, resolve: firstChunkReceived } =
                Promise.withResolvers<void>();
            const { promise: firstResponse, resolve: firstResponseCompleted } =
                Promise.withResolvers<void>();

            const config: ServeConfig = {
                abortSignal: controller.signal,
                onListen: async ({ port }) => {
                    socket = net.connect(port, "localhost");

                    socket.on("error", () => {
                        // The server may reset the socket while the second request is in flight.
                    });

                    socket.on("data", (chunk) => {
                        if (firstResponseDone) {
                            dataAfterFirstResponse = true;
                            return;
                        }

                        responseData += chunk.toString();

                        if (responseData.includes("hello")) {
                            firstChunkReceived();
                        }

                        if (responseData.includes("\r\n0\r\n\r\n")) {
                            firstResponseDone = true;
                            firstResponseCompleted();
                        }
                    });

                    socket.on("end", () => {
                        socketEnded();
                    });

                    socket.write("GET / HTTP/1.1\r\nhost: localhost\r\n\r\n");
                    await firstChunk;

                    controller.abort();
                    releaseBody();

                    await firstResponse;
                    socket.write("GET / HTTP/1.1\r\nhost: localhost\r\n\r\n");
                },
            };

            try {
                await withTimeout(serve(service, config), 2000, "serve() did not resolve");
                await withTimeout(
                    socketEnd,
                    1000,
                    "socket was not closed after the in-flight response finished",
                );

                assert(
                    !dataAfterFirstResponse,
                    "second request on kept-alive socket should not be served during shutdown",
                );
            } finally {
                socket?.destroy();
            }
        });

        it("aborts the disconnect signal when the client disconnects mid-response", async () => {
            const encoder = new TextEncoder();
            const { promise: disconnected, resolve: sawDisconnect } = Promise.withResolvers<void>();

            const service = makeMockService((req) => {
                const signal = req.extensions.get(DISCONNECT_SIGNAL);
                assert(signal);
                signal.addEventListener("abort", () => sawDisconnect());

                async function* endlessChunks(): AsyncGenerator<Uint8Array> {
                    while (true) {
                        yield encoder.encode("data: ping\n\n");
                        await delay(20);
                    }
                }

                return new HttpResponse(
                    StatusCode.OK,
                    new HeaderMap(),
                    new Body(ReadableStream.from(endlessChunks())),
                );
            });

            const serverController = new AbortController();

            const config: ServeConfig = {
                abortSignal: serverController.signal,
                onListen: async ({ port }) => {
                    const fetchController = new AbortController();
                    const response = await fetch(`http://localhost:${port}`, {
                        signal: fetchController.signal,
                    });
                    await response.body?.getReader().read();
                    fetchController.abort();

                    await withTimeout(
                        disconnected,
                        1000,
                        "disconnect signal was not aborted on client disconnect",
                    ).finally(() => {
                        serverController.abort();
                    });
                },
            };

            await withTimeout(serve(service, config), 2000, "serve() did not resolve");
            await disconnected;
        });

        it("aborts the disconnect signal when a connection is force-closed at the deadline", async () => {
            const encoder = new TextEncoder();
            const { promise: disconnected, resolve: sawDisconnect } = Promise.withResolvers<void>();

            const service = makeMockService((req) => {
                const signal = req.extensions.get(DISCONNECT_SIGNAL);
                assert(signal);
                signal.addEventListener("abort", () => sawDisconnect());

                async function* endlessChunks(): AsyncGenerator<Uint8Array> {
                    while (true) {
                        yield encoder.encode("data: ping\n\n");
                        await delay(20);
                    }
                }

                return new HttpResponse(
                    StatusCode.OK,
                    new HeaderMap(),
                    new Body(ReadableStream.from(endlessChunks())),
                );
            });

            const controller = new AbortController();
            let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

            const config: ServeConfig = {
                shutdownTimeout: 200,
                abortSignal: controller.signal,
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    reader = response.body?.getReader();
                    await reader?.read();
                    controller.abort();
                },
            };

            try {
                await withTimeout(serve(service, config), 2000, "serve() did not resolve");
                await withTimeout(
                    disconnected,
                    1000,
                    "disconnect signal was not aborted on force-close",
                );
            } finally {
                await reader?.cancel().catch(() => undefined);
            }
        });

        it("does not abort the disconnect signal when the response completes normally", async () => {
            let disconnectSignal: AbortSignal | undefined;

            const service = makeMockService((req) => {
                disconnectSignal = req.extensions.get(DISCONNECT_SIGNAL);
                return HttpResponse.builder().body("hello");
            });

            const controller = new AbortController();

            const config: ServeConfig = {
                abortSignal: controller.signal,
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    await response.text();
                    controller.abort();
                },
            };

            await withTimeout(serve(service, config), 2000, "serve() did not resolve");

            assert(disconnectSignal);
            assert(!disconnectSignal.aborted, "disconnect signal must not abort on completion");
        });

        it("allows streaming responses to end cooperatively via the shutdown signal", async () => {
            const encoder = new TextEncoder();
            let clientBody = "";

            const service = makeMockService((req) => {
                const shutdownSignal = req.extensions.get(SHUTDOWN_SIGNAL);
                assert(shutdownSignal);

                async function* events(signal: AbortSignal): AsyncGenerator<Uint8Array> {
                    while (!signal.aborted) {
                        yield encoder.encode("data: ping\n\n");
                        await delay(20);
                    }

                    yield encoder.encode("data: bye\n\n");
                }

                return new HttpResponse(
                    StatusCode.OK,
                    new HeaderMap(),
                    new Body(ReadableStream.from(events(shutdownSignal))),
                );
            });

            const controller = new AbortController();
            const { promise: clientDone, resolve: clientFinished } = Promise.withResolvers<void>();

            const config: ServeConfig = {
                abortSignal: controller.signal,
                onListen: async ({ port }) => {
                    const response = await fetch(`http://localhost:${port}`);
                    const reader = response.body?.getReader();
                    assert(reader);
                    await reader.read();
                    controller.abort();

                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            break;
                        }

                        clientBody += decoder.decode(value);
                    }

                    clientFinished();
                },
            };

            // No shutdownTimeout: shutdown completes through cooperation alone.
            await withTimeout(serve(service, config), 2000, "serve() did not resolve");
            await withTimeout(clientDone, 1000, "client did not receive the end of the stream");

            assert.match(clientBody, /data: bye/);
        });
    });
});
