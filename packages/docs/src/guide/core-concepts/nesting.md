---
description: Nesting multiple routers together. 
---

# Nesting

Except for small applications, it is very uncommon to have a single giant router instance defined in one place with all
routes. Taxum acknowledges this and provides a way to nest routers together. This has no performance implication at
runtime, as all path routes get internally merged into one router instance.

```ts
import { m, Router } from "@taxum/core/routing";

const fooRouter = new Router()
    .route("/bar", m.get(() => "bar"));

const router = new Router()
    .nest("/foo", fooRouter);
```

In this constellation, the "bar" response will be emitted from `GET /foo/bar`. Note that the nesting paths are allowed
to have path parameters in them as well.
