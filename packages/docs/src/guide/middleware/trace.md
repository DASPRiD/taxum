# Trace Middleware

A middleware that traces HTTP request lifecycles, logging events when a request is received, a response is produced, or
a failure is detected. Useful for observability, debugging, and monitoring the latency of requests.

## Example

```ts
import { TraceLayer } from "@taxum/core/middleware/trace";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get(() => "Hello World"))
    .layer(new TraceLayer());
```

## How It Works

1. When a request is received, the `onRequest` handler is invoked.
2. After the service produces a response, the `onResponse` handler is called with the response and latency.
3. The response is classified using the configured `Classifier`. If a classification string is returned, the `onFailure`
   handler is invoked with the classification and latency.

By default, logging goes through the global logger:

- `onRequest`: logs "started processing request" as debug
- `onResponse`: logs "finished processing request" with status and latency as debug
- `onFailure`: logs "response failed" with classification and latency as error

## Configuration

### Custom Classifier

A classifier determines whether a response counts as a failure. It returns a string classification (e.g.
`Internal Server Error`) or null if the response is considered successful.

```ts
import { TraceLayer } from "@taxum/core/middleware/trace";

const layer = new TraceLayer().classifier({
    classifyResponse: (res) =>
        res.status.isServerError() ? res.status.phrase : null,
});
```

### Custom Request Handler

Handles logic when a request is first received.

```ts
import { TraceLayer } from "@taxum/core/middleware/trace";

const layer = new TraceLayer().onRequest({
    onRequest: (req) => {
        console.info("Got request", { path: req.path });
    },
});
```

### Custom Response Handler

Handles logic when a response is produced.

```ts
import { TraceLayer } from "@taxum/core/middleware/trace";

const layer = new TraceLayer().onResponse({
    onResponse: (res, latency) => {
        console.info("Response finished", {
            status: res.status.code,
            latency,
        });
    },
});
```

### Custom Failure Handler

Handles logic when a request fails (as determined by the classifier).

```ts
import { TraceLayer } from "@taxum/core/middleware/trace";

const layer = new TraceLayer().onFailure({
    onFailure: (classification, latency) => {
        console.error("Request failed", { classification, latency });
    },
});
```

## Layer Ordering 

This middleware can be applied at any point in the stack, but for accurate latency measurement, it should wrap as much
of the request pipeline as possible (ideally the outermost layer).
