---
description: Testing your handlers and middleware. 
---

# Testing

Taxum is built with testability in mind. You have two ways to test your application; either through unit testing or
integration testing.

## Unit Testing

To test individual units of your application, e.g. your handlers, all you have to do is create an HTTP request and make
assertions on the HTTP response. There is a builder on the `HttpRequest` to make your life easier. To assert things
about the body, it is recommended to use Node.js' `consumers` utility to read the body.

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import consumers from "node:stream/consumers";
import { query } from "@taxum/core/extract";
import { HttpRequest, jsonResponse, StatusCode } from "@taxum/core/http";
import { createExtractHandler } from "@taxum/core/routing";
import { z } from "zod";

const myHandler = createExtractHandler(
    query(z.object({id: z.string()})),
).handler(({id}) => jsonResponse({id}));

test("handler returns correct response", async () => {
    const req = HttpRequest.builder()
        .uri(new URL("http://localhost/?id=5"))
        .body(null);

    const res = await myHandler(req);
    assert.equal(res.status, StatusCode.OK);

    const body = await consumers.json(res.body.readable);
    assert.deepEqual(body, { id: "5" });
});
```

## Integration Testing

Alternatively to unit testing, you can also test the entire request flow through all layers. This works similar to unit
testing, except that you invoke the router directly:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import consumers from "node:stream/consumers";
import { query } from "@taxum/core/extract";
import { HttpRequest, jsonResponse, StatusCode } from "@taxum/core/http";
import { m, Router } from "@taxum/core/routing";
import { z } from "zod";

const router = new Router();
    router.route("/health", m.get(() => "healthy"));

test("router returns health response", async () => {
    const req = HttpRequest.builder()
        .uri(new URL("http://localhost/health"))
        .body(null);

    const res = await router.invoke(req);
    assert.equal(res.status, StatusCode.OK);

    const body = await consumers.text(res.body.readable);
    assert.equal(body, "healthy");
});
```
