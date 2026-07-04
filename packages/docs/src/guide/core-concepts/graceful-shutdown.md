---
description: Shutting down a Taxum server without dropping in-flight requests.
---

# Graceful Shutdown

`serve()` shuts down gracefully when the configured `abortSignal` aborts or, with `catchCtrlC` enabled, when the
process receives `SIGINT`, `SIGQUIT` or `SIGTERM`.

```ts
import { serve } from "@taxum/core/server";

await serve(router, {
    port: 8080,
    catchCtrlC: true,
    shutdownTimeout: 5000,
});
```

Once shutdown begins:

1. The server stops accepting new connections, and idle keep-alive connections are closed immediately.
2. In-flight requests complete normally. Their responses are marked `connection: close`, and their sockets are closed
   as soon as the response has finished, so clients cannot keep reusing them.
3. `serve()` resolves once the last connection has closed.

## Shutdown timeout

Without a `shutdownTimeout`, the server waits indefinitely for in-flight requests. A single long-running response, such
as an endless stream, keeps the process alive until an orchestrator kills it.

With `shutdownTimeout` set, all remaining connections are forcefully closed once the timeout expires. Their response
body streams are cancelled, so a streaming body backed by an async generator has its `finally` blocks run.

You should always configure a `shutdownTimeout` in production. Pick a value below the grace period of your process
supervisor (Kubernetes gives 30 seconds by default), so Taxum closes connections cleanly instead of dying mid-write.

## Cooperative shutdown

Handlers producing long-running responses shouldn't wait for the forceful close. The `SHUTDOWN_SIGNAL` extension
contains an `AbortSignal` which aborts the moment shutdown begins, while the connection is still writable. This gives
streaming responses a chance to send a final message and end cleanly:

```ts
import { setTimeout as delay } from "node:timers/promises";
import { extension } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { SHUTDOWN_SIGNAL } from "@taxum/core/server";

const streamHandler = createExtractHandler(extension(SHUTDOWN_SIGNAL, true)).handler(
    (shutdownSignal) => {
        async function* events(): AsyncGenerator<string> {
            while (!shutdownSignal.aborted) {
                yield "tick\n";
                await delay(1000);
            }

            yield "server is shutting down, goodbye\n";
        }

        return ReadableStream.from(events());
    },
);
```

When every response ends cooperatively, shutdown completes without waiting for the timeout at all.

## Disconnect signal

The related `DISCONNECT_SIGNAL` extension aborts when the connection is closed before the response has finished,
whether because the client disconnected or because the connection was forcefully closed at the shutdown timeout.
Either way nothing the handler produces can be delivered anymore, so use it to cancel work whose result no one will
receive:

```ts
import { extension } from "@taxum/core/extract";
import { jsonResponse } from "@taxum/core/http";
import { createExtractHandler } from "@taxum/core/routing";
import { DISCONNECT_SIGNAL } from "@taxum/core/server";

const reportHandler = createExtractHandler(extension(DISCONNECT_SIGNAL, true)).handler(
    async (disconnectSignal) => {
        const report = await generateExpensiveReport({ signal: disconnectSignal });
        return jsonResponse(report);
    },
);
```

Both extensions are only present on requests created by `serve()`. Requests built manually, e.g. in tests, don't carry
them, so the extractors return `undefined` unless the `required` flag is set.
