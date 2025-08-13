---
title: Getting Started
---

# Getting Started

## Introduction

Taxum is a next-generation HTTP server framework for Node.js. It introduces concepts found in Rust's `Tower` and `Axum`
frameworks to the TypeScript world.

The core concept is that every middleware and handler is a {@link @taxum/core!routing.Service | service} which ingests
an {@link @taxum/core!http.HttpRequest | HttpRequest} and returns
an {@link @taxum/core!http.HttpResponse | HttpResponse}.

The router allows layering handlers like an onion. In contrast to other frameworks where you usually define the
middlewares first and every handler registered after will be layered by that middleware, in Taxum you define the
handlers first and layer them afterward from the inside out.

Handlers themself are internally handled as services as well, but they are defined through raw
{@link @taxum/core!routing.Handler | handler functions}. While you can use handlers the same way as in other frameworks,
where you manually parse the HTTP request, the preferred way in Taxum is to use them via
{@link @taxum/core!routing.extractHandler | extractors}. These allow you to define what you want to extract from the
request beforehand, tied to validation, and your actual handler will only have to care about the business logic.

Another big difference to other frameworks is how errors are handled. While normally you have error handling
middleware, in Taxum errors are handled after every handler and layer through an error handler. This ensures that outer
layers modifying the response are not short-circuited.

The last important bit to note is that while services internally always return an `HttpResponse`, you can define all
your layers and handlers to return an {@link @taxum/core!http.HttpResponseLike | HttpResponseLike} value instead. This
allows you to return any kind of value, which can be converted into an `HttpResponse`.

## Installation

```bash
npm install @taxum/core
# or
pnpm add @taxum/core
# or
yarn install @taxum/core
```

## Quick Start

Basic routing happens in two parts. First, the {@link @taxum/core!routing.Router | main router} matches a path and then
delegates to a {@link @taxum/core!routing.MethodRouter | MethodRouter} for matching the method. You can define method
routes either separately for the same path or create one method router with multiple methods.

In the following example we are using [zod](https://github.com/colinhacks/zod) for validation, but you can use any
library that implements the [Standard Schema](https://github.com/standard-schema/standard-schema).

```ts
import { pathParam } from "@taxum/core/extract"
import { jsonResponse } from "@taxum/core/http"
import { extractHandler, m, Router } from "@taxum/core/routing"
import { serve } from "@taxum/core/server"
import { z } from "zod";

// In this case we are not extracing anything from the
// request, so we can define a simple handler.
const listUsers = () => jsonResponse([
    { id: "1" }, // user 1
    { id: "2", }, // user 2
]);

// You can define zero or more extractors; the inner handler
// will receive values in the same order.
const getUser = extractHandler(
    pathParam(z.coerce.number().int()),
    (id) => {
        return jsonResponse({ id });
    },
);

const router = new Router()
    .route("/users", m.get(listUsers))
    .route("/users/:userId", m.get(getUser));

// This will serve the router on port 8080 and returns once
// the server gets closed. 
await serve(router, { port: 8080 });
```
