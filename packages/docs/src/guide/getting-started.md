# Getting Started

## Overview

Taxum is a TypeScript-first HTTP server framework for Node.js. It combines familiar string-based routing with a powerful
extractor system, a composable middleware architecture, and predictable error handling.

In this guide, you’ll install Taxum and create a small API with just a few lines of code.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) version 22 or higher.
- [TypeScript](https://www.typescriptlang.org/) version 5 or higher, though you could use this library with pure
  JavaScript (not recommended).
- ESM-only (no CommonJS support)

::: code-group

```sh [npm]
$ npm add @taxum/core
```

```sh [pnpm]
$ pnpm add @taxum/core
```

```sh [yarn]
$ yarn add @taxum/core
```

```sh [bun]
$ bun add @taxum/core
```

:::

::: tip NOTE

Taxum is an ESM-only project. Don't use `require()` to import it, and make sure your nearest `package.json`
contains `"type": "module"`, or change the file extension of your relevant files to `.mjs`/`.mts`.

:::

## Quick Start

Routing in Taxum happens in two steps:

1. The main rotuer matches the request path.
2. A method rotuer matches the HTTP method (`GET`, `POST`, etc.).

Example with [zod](https://github.com/colinhacks/zod) for validation:

```ts
import { pathParam } from "@taxum/core/extract";
import { jsonResponse } from "@taxum/core/http";
import { extractHandler, m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import { z } from "zod";

// Handler without extractors
const listUsers = () => jsonResponse([
  { id: "2b5954aa-4a83-4825-ac15-7c7d48f02430" },
  { id: "cdca2073-020e-464d-bdd4-881fab2b3446" },
]);

// Handler with extractor for typed userId
const getUser = extractHandler(
  pathParam(z.uuid()),
  (id) => jsonResponse({ id }),
);

const router = new Router()
  .route("/users", m.get(listUsers))
  .route("/users/:userId", m.get(getUser));

await serve(router, { port: 8080 });
```

## Next Steps

- Learn more about layers to add logging, authentication, or rate limiting.
- Explore extractors for query parameters, request bodies and headers.
- See the API reference for details on routers, handlers, and services.

