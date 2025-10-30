---
description: How to return responses from handlers.
---

# Handlers

A handler is a function that takes an HTTP request and produces a response. Handlers are flexible, they don’t need to
return a full `HttpResponse` object. You can return any value that can be converted into a response, which allows simple
handlers to be concise while still supporting full control when needed.

## Basic handler examples

### Plain text

```ts
const helloHandler = () => "Hello World";
```

### JSON

```ts
import { jsonResponse } from "@taxum/core/http";

const jsonHandler = () => jsonResponse({ message: "Hello JSON" });
```

### HTML

```ts
import { htmlResponse } from "@taxum/core/http";

const jsonHandler = () => htmlResponse("<h1>Hello</h1>");
```

### No Content

```ts
import { noContentResponse } from "@taxum/core/http";

const emptyHandler = () => noContentResponse;
```

## Tuple Return Types

Handlers in Taxum can return tuples to compose responses in a flexible way. These tuples let you specify status,
headers, body, or other response parts in a structured order.

### Status and Body

```ts
const handler = () => [201, "Created"];
```

### Headers and Body

```ts
const handler = () => [[["X-Custom", "value"]], "Hello"];
```

### Status, Headers, and Body

```ts
const handler = () => [201, [["X-Custom", "value"]], "Created"];
```

## Full `HttpResponse`

For advanced use, you can return a full `HttpResponse` to control status, headers, or extensions:

```ts
import { HttpResponse } from "@taxum/core/http";

const customHandler = () =>
    HttpResponse.builder()
        .status(201)
        .header("X-Custom", "value")
        .body("Created");
```
