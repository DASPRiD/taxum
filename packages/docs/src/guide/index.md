# Introduction

Taxum is a modern, TypeScript-first web framework for Node.js, inspired by Rust's
[Axum](https://github.com/tokio-rs/axum).

It brings predictable routing, type-safe extractors, and a composable middleware system to your backend development, so
you can build APIs with confidence, clarity, and speed.

## Why Taxum?

Taxum takes proven ideas from Axum and adapts them for the JavaScript and TypeScript ecosystem:

- **Composable Middleware**: Build pipelines of reusable logic, keeping concerns cleanly separated.
- **Type-Safe by Design**: Get compile-time checks for route parameters, request bodies, and responses.
- **Familiar Paths, Strong Typing**: Keep standard string routes but pair them with extractors for validation.
- **Performance-Aware**: Minimal overhead with predictable execution for high-throughput APIs.

## When to Use Taxum

Choose Taxum if you want:

- A TypeScript-first approach without boilerplate.
- Clear, declarative routing that scales with your app.
- Validation and type safety baked into request handling.
- The flexibility to compose functionality from small, testable pieces.

## Quick Example

```ts
import { pathParam } from "@taxum/core/extract";
import { m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import { z } from "zod";

const router = new Router()
    .route("/hello/:name", m.get(
        pathParam(z.string().toLowerCase()),
        (name) => `Hello, ${name}`,
    ));

await serve(router, { port: 3000 });
```

This example shows a standard string path with an extractor that validates and types the name parameter, keeping your
handler simple and safe.

