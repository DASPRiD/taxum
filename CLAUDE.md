# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taxum is a composable, type-safe HTTP framework for Node.js inspired by Rust's Axum and Tower. It's a pnpm monorepo with four published packages: `@taxum/core`, `@taxum/cookie`, `@taxum/jwt`, `@taxum/fs`, plus `@taxum/docs` (VitePress) and `@taxum/examples`.

## Commands

- **Build all**: `pnpm -r build`
- **Test all**: `pnpm test`
- **Test single package**: `cd packages/core && pnpm test`
- **Test single file**: `cd packages/core && npx tsx --test test/some-test.ts`
- **Type check**: `pnpm typecheck`
- **Lint & fix**: `pnpm check`
- **Format**: `pnpm format`

## Architecture

### Service/Layer Model (Tower-style)

The core abstraction is `Service<Request, Response>` with an `invoke(req)` method. `HttpService` specializes this for HTTP. Middleware is implemented as `Layer<Out, In>` which wraps one service into another. `ServiceBuilder` provides a fluent API for composing layers: `withLayer()`, `fromFn()`, `catchError()`, `mapToHttpResponse()`.

### Routing

`Router` is the main entry point. It uses `MethodRouter` for HTTP method dispatch and `PathRouter` (backed by find-my-way) for trie-based path matching. Routes are composed declaratively as data structures.

### Extraction System

`Extractor<T>` pulls typed data from `HttpRequest`. Built-in extractors: `json()`, `query()`, `path()`, `form()`, `header()`, `rawQuery()`, `extension()`, `error()`. Extractors support Standard Schema validation (e.g., Zod). `createExtractHandler()` wires extractors into type-safe handlers.

### HTTP Primitives

`HttpRequest` wraps Node's IncomingMessage with extensions. `HttpResponse` is a builder with status, headers, body, and extensions. Both use an extension system for storing arbitrary typed context.

### Middleware

Located in `packages/core/src/middleware/`. Includes: compression, CORS, request/response headers, client IP, body limits, request ID, sensitive headers, and status code setting.

## Code Conventions

- **Module system**: ESM (`"type": "module"`) throughout
- **TypeScript**: Strict mode, targets Node 22 (`@tsconfig/node22`)
- **Formatting**: Biome with 4-space indent, 100 char line width
- **Linting**: Biome strict rules — no `console`, no unused imports, block statements required
- **Testing**: Node.js native `node:test` with `tsx`, using `assert/strict`
- **Commits**: Conventional commits enforced via commitlint + lefthook
- **Releases**: Automated via release-please with node-workspace plugin
