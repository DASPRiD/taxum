---
description: Mark certain headers as sensitive on both requests and responses to exclude them from logs. 
---

# Sensitive Headers Middleware

The sensitive headers middleware allows you to mark certain headers as sensitive on both requests and responses. Marking
a header a sensitive will prevent the headers from showing up in logs.

## Layers

### `SetSensitiveHeadersLayer`

This layer will mark headers on both requests and responses as sensitive.

```ts
import { SetSensitiveHeadersLayer } from "@taxum/core/middleware/sensitive-headers";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get((req) => "Hello World"))
    .layer(new SetSensitiveHeadersLayer(["x-secret-header"]));
```

### `SetSensitiveRequestHeadersLayer`

This layer will mark headers on requests as sensitive.

```ts
import { SetSensitiveRequestHeadersLayer } from "@taxum/core/middleware/sensitive-headers";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get((req) => "Hello World"))
    .layer(new SetSensitiveRequestHeadersLayer(["authorization", "cookie"]));
```

### `SetSensitiveResponseHeadersLayer`

This layer will mark headers on responses as sensitive.

```ts
import { SetSensitiveResponseHeadersLayer } from "@taxum/core/middleware/sensitive-headers";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get((req) => "Hello World"))
    .layer(new SetSensitiveResponseHeadersLayer(["set-cookie"]));
```
