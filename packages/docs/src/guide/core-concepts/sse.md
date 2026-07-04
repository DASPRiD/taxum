---
description: How to stream Server-Sent Events (SSE) from handlers.
---

# Server-Sent Events

Server-Sent Events (SSE) allow your server to push events to the client over a long-lived HTTP connection. The browser's
built-in [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) API handles reconnection
automatically, making SSE ideal for real-time updates like notifications, live feeds, or AI token streaming.

## Basic usage

Return an `Sse` instance from your handler. The simplest approach is to use an async generator:

```ts
import { Sse, type SseEvent } from "@taxum/core/sse";
import { m, Router } from "@taxum/core/routing";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const handler = () => {
    async function* events(): AsyncGenerator<SseEvent> {
        for (let i = 0; i <= 10; i++) {
            yield {
                event: "tick",
                id: String(i),
                data: `Counter: ${i}`,
            };

            await sleep(1000);
        }
    }

    return new Sse(events());
};

const router = new Router().route("/events", m.get(handler));
```

You can also pass a `ReadableStream<SseEvent>` if you prefer:

```ts
import { Sse, type SseEvent } from "@taxum/core/sse";

const handler = () => {
    const stream = new ReadableStream<SseEvent>({
        start: (controller) => {
            controller.enqueue({ data: "hello" });
            controller.close();
        },
    });

    return new Sse(stream);
};
```

The `Sse` class sets the following response headers automatically:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`

## Event fields

`SseEvent` is a plain object. All fields are optional:

```ts
const event: SseEvent = {
    event: "update",       // Event type (maps to addEventListener on the client)
    id: "42",              // Event ID (sent as Last-Event-ID on reconnect)
    data: "hello world",   // Event data
    retry: 5000,           // Reconnection hint in milliseconds
    comment: "metadata",   // Comment line (ignored by the client)
};
```

### JSON data

Serialize JSON data with `JSON.stringify()`:

```ts
const event: SseEvent = {
    event: "price",
    data: JSON.stringify({ symbol: "AAPL", price: 150.25 }),
};
```

### Multi-line data

Newlines (`\n`), carriage returns (`\r`), and CRLF sequences in data are automatically split across multiple `data:`
lines per the SSE specification:

```ts
const event: SseEvent = {
    data: "line one\nline two\nline three",
};
// Produces:
// data: line one
// data: line two
// data: line three
```

### Validation

The `event` and `comment` fields must not contain newlines or carriage returns. The `id` field must additionally not
contain null characters. The `retry` field must be a non-negative integer. Invalid values cause an error when the event
is serialized.

## Keep-alive

Proxies and load balancers often close idle connections. Enable keep-alive to send periodic comment lines that keep the
connection open:

```ts
new Sse(stream).keepAlive()
```

The default interval is 15 seconds with an empty comment. You can customize both:

```ts
new Sse(stream).keepAlive({
    interval: 30_000,
    comment: "ping",
})
```

Keep-alive messages are only sent when the stream is idle. The timer resets each time a real event is emitted.

## Client-side reconnection

The browser's `EventSource` automatically reconnects when the connection drops. To support resuming from the correct
position:

1. Set an `id` on each event
2. On reconnect, the browser sends the last received ID as the `Last-Event-ID` request header
3. Read this header in your handler to resume the stream

```ts
import { Sse, type SseEvent } from "@taxum/core/sse";
import { m, Router } from "@taxum/core/routing";
import type { HttpRequest } from "@taxum/core/http";

const handler = (req: HttpRequest) => {
    const lastId = Number.parseInt(req.headers.get("last-event-id")?.value ?? "", 10);
    const startFrom = Number.isNaN(lastId) ? 0 : lastId + 1;

    async function* events(): AsyncGenerator<SseEvent> {
        for (let i = startFrom; i < 100; i++) {
            yield {
                id: String(i),
                data: `Event ${i}`,
            };
        }
    }

    return new Sse(events());
};

const router = new Router().route("/events", m.get(handler));
```

Use `retry` to tell the client how long to wait before reconnecting:

```ts
const event: SseEvent = {
    retry: 5000,
    data: "hello",
};
```

## Graceful shutdown

An SSE stream never ends on its own, so it blocks a [graceful shutdown](/guide/core-concepts/graceful-shutdown) until
the `shutdownTimeout` force-closes the connection. End the stream cooperatively instead: the `SHUTDOWN_SIGNAL`
extension aborts the moment shutdown begins, while the connection is still writable, so you can send a final event
with a `retry` hint before closing:

```ts
import { extension } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { SHUTDOWN_SIGNAL } from "@taxum/core/server";
import { Sse, type SseEvent } from "@taxum/core/sse";

const handler = createExtractHandler(extension(SHUTDOWN_SIGNAL, true)).handler(
    (shutdownSignal) => {
        async function* events(): AsyncGenerator<SseEvent> {
            let counter = 0;

            while (!shutdownSignal.aborted) {
                yield { id: String(counter++), data: "tick" };
                await sleep(1000);
            }

            yield { retry: 5000, comment: "server shutting down" };
        }

        return new Sse(events());
    },
);
```

The client's `EventSource` reconnects after the `retry` delay, resuming against a fresh server instance via
`Last-Event-ID` as shown above. When every stream ends cooperatively, the server shuts down without waiting for the
timeout.

## Client disconnects

When the client disconnects, the event stream is cancelled automatically. For an async generator this runs its
`finally` blocks, which is the place to release resources:

```ts
async function* events(): AsyncGenerator<SseEvent> {
    const subscription = pubsub.subscribe("news");

    try {
        for await (const message of subscription) {
            yield { data: message };
        }
    } finally {
        subscription.unsubscribe();
    }
}
```

If your producer performs work outside the generator, the `DISCONNECT_SIGNAL` extension provides the same information
as an `AbortSignal`; see [Graceful Shutdown](/guide/core-concepts/graceful-shutdown#disconnect-signal).
