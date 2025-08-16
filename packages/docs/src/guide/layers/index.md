# Layers Overview

## What is a layer?

In Taxum, a layer is a composable wrapper around one or more routes. Layers allow you to add functionality like logging,
compression, authentication, or other cross-cutting concerns without modifying the handlers themselves.

Unlike many other frameworks, layers in Taxum are applied after the routes they wrap, evaluated outside-in. This means
that the last layer you add wraps all previously defined routes and layers, and the first layer added is the innermost.

Some layers are request-focused (e.g., `RequestDecompressionLayer`) and act before the handler, while others are
response-focused (e.g., `ResponseCompressionLayer`) and act after the handler. Correct ordering ensures predictable
behavior.

## How layers are composed

- **Order matters**: Layers wrap routes in the order they are applied.
- **Scope is local**: Only routes defined before a .layer() call get wrapped.
- **Nested routers**: Layers applied on a nested router itself are always inner layers. Any layers applied after nesting
  the router wrap those inner layers and act as outer layers, because layers always wrap previously applied layers.

Outermost layers will receive the request first and receive the response last.

### Example: Layer Order and Nesting

```ts
import { SetClientIpLayer } from "@taxum/core/layer/client-ip";
import { ResponseCompressionLayer } from "@taxum/core/layer/compression";
import { RequestDecompressionLayer } from "@taxum/core/layer/decompression";
import { m, Router } from "@taxum/core/routing";

// Main router
const apiRouter = new Router()
    .route("/users", m.get(() => "list of users"))
    .route("/posts", m.get(() => "list of posts"))
    .layer(new SetClientIpLayer()) // only applies to /users and /posts
    .route("/health", m.get(() => "ok"));

// Nested router for admin
const adminRouter = new Router()
    .route("/", m.get(() => "admin"))
    .layer(authLayer); // only admin routes need authentication

// Nest admin router under /admin with logging applied outside
apiRouter.nest("/admin", adminRouter).layer(loggingLayer)
    // Outermost layers, applies to all previous routes
    .layer(new RequestDecompressionLayer())
    .layer(new ResponseCompressionLayer())
```

In this setup, the routes have the following request/response flow:

```mermaid
graph LR
  A[ResponseCompressionLayer] -->|Request| B(RequestDecompressionLayer)
  B -->|Request| C[SetClientIpLayer]
  C -->|Request| D[ /users]
  D -->|Response| C
  C -->|Response| B
  B -->|Response| A
```

```mermaid
graph LR
  A[ResponseCompressionLayer] -->|Request| B(RequestDecompressionLayer)
  B -->|Request| C[SetClientIpLayer]
  C -->|Request| D[ /posts]
  D -->|Response| C
  C -->|Response| B
  B -->|Response| A
```

```mermaid
graph LR
  A[ResponseCompressionLayer] -->|Request| B(RequestDecompressionLayer)
  B -->|Request| C[ /health]
  C -->|Response| B
  B -->|Response| A
```

```mermaid
graph LR
  A[ResponseCompressionLayer] -->|Request| B(RequestDecompressionLayer)
  B -->|Request| C[authLayer]
  C -->|Request| D[ /admin]
  D -->|Response| C
  C -->|Response| B
  B -->|Response| A
```

This example demonstrates how inside-out evaluation ensures predictable composition of reusable layers while keeping
route logic clean.
