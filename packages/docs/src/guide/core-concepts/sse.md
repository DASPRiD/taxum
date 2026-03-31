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
- `Connection: keep-alive`

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
    const lastId = req.headers.get("last-event-id")?.value;
    const startFrom = lastId ? Number.parseInt(lastId, 10) + 1 : 0;

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
