---
description: How to serve static files from your filesystem. 
---

# Serving Static Files

Taxum supports serving static files from your filesystem via the {@link @taxum/fs!ServeDir | ServeDir} service.

You have two options to serve files: You can either nest the `ServeDir` service under a given nested route or you can
serve files standalone.

## Installation

::: code-group

```sh [npm]
$ npm add @taxum/fs
```

```sh [pnpm]
$ pnpm add @taxum/fs
```

```sh [yarn]
$ yarn add @taxum/fs
```

```sh [bun]
$ bun add @taxum/fs
```

:::

## Nested

```ts
import { Router } from "@taxum/core/routing";
import { ServeDir } from "@taxum/fs";
import { serve } from "@taxum/core/server";

const router = new Router()
    .nestService("/assets", new ServeDir("/assets"));

await serve(router);
```

## Standalone

```ts
import { ServeDir } from "@taxum/fs";
import { serve } from "@taxum/core/server";

await serve(new ServeDir("/assets"));
```
