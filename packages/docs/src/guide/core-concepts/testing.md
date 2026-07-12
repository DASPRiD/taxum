---
description: Testing your handlers and taxum stacks with @taxum/testing.
---

# Testing

Taxum ships a dedicated test client in `@taxum/testing`. It runs requests through your stack in-process, without
opening a socket: routes, extractors, and middleware execute the same way as under `serve()`, with a few
connection-level exceptions covered in [What stays outside](#what-stays-outside). Requests and responses stay plain
objects you can assert on.

## Installation

The package is only needed at development time:

::: code-group

```sh [npm]
$ npm add -D @taxum/testing
```

```sh [pnpm]
$ pnpm add -D @taxum/testing
```

```sh [yarn]
$ yarn add -D @taxum/testing
```

```sh [bun]
$ bun add -D @taxum/testing
```

:::

## Your first test

Create a client from a router and await requests on it:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { m, Router } from "@taxum/core/routing";
import { testClient } from "@taxum/testing";

const router = new Router().route("/health", m.get(() => "healthy"));

test("health endpoint responds", async () => {
    const res = await testClient(router).get("/health");

    assert.equal(res.status, 200);
    assert.equal(await res.text(), "healthy");
});
```

`testClient()` accepts any `HttpService`, not just a `Router`, so a stack wrapped in middleware layers tests the same
way.

## Building requests

Every HTTP verb has a method (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`). The returned request is
thenable: awaiting it sends it. Before that, you can chain configuration:

```ts
const res = await client
    .post("/users")
    .header("authorization", `Bearer ${token}`)
    .query({ notify: true })
    .json({ name: "Ben" });
```

- `.query()` takes a flat record (arrays become repeated keys), a `URLSearchParams`, or a pre-formed query string,
  e.g. nested bracket syntax: `.query("filter[status]=open")`.
- `.json(value)` sets a JSON body and implies `content-type: application/json`.
- `.form(record)` sets a URL-encoded body and implies `content-type: application/x-www-form-urlencoded`.
- `.body(bodyLike)` sets a raw body (string, `Buffer`, stream, ...) and implies nothing.
- `.cookie(name, value)` adds a request cookie; `.headers(entries)` appends in bulk.

An explicit `.header("content-type", ...)` always wins over the implied one. `content-length` is set automatically
for buffered bodies, so body-limit middleware behaves as in production.

A request carries at most one body: once `.json()`, `.form()`, or `.body()` has been called, the body setters
disappear from the type, so a second call doesn't compile.

Requests send exactly once. Awaiting the same request again returns the same response, and calling a setter after the
send throws.

## Asserting on responses

Responses read like fetch `Response` objects: `status` is a plain number, `headers` is a native
[`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object, and the body readers are async. Unlike
fetch, the body is buffered on first read, so you can read it repeatedly and in different formats:

```ts
const res = await client.get("/users/5");

assert.equal(res.status, 200);
assert.equal(res.headers.get("content-type"), "application/json");
assert.deepEqual(await res.json(), { id: "5" });
assert.match(await res.text(), /"id"/);
```

Bodies are decompressed automatically based on the `content-encoding` header, so
[compression middleware](/guide/middleware/compression) doesn't get in the way of assertions. Repeated `set-cookie` headers are available via `res.headers.getSetCookie()`.

For anything taxum-specific (extensions, the `StatusCode` instance, or exact multi-value headers), the underlying
`HttpResponse` is available as `res.inner`.

::: info Errors become responses
A router converts thrown errors into error responses, so a failing handler yields a `res` with a 4xx/5xx status
rather than a rejected promise. Assert on `res.status`; `try`/`catch` is only needed when you invoke a bare service
without a router.
:::

## Testing handlers directly

For unit tests that call a handler without a router, build the request with core's builder and wrap the result in
`TestResponse.from()` to get the same reading interface:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { query } from "@taxum/core/extract";
import { HttpRequest, jsonResponse } from "@taxum/core/http";
import { createExtractHandler } from "@taxum/core/routing";
import { TestResponse } from "@taxum/testing";
import { z } from "zod";

const myHandler = createExtractHandler(query(z.object({ id: z.string() }))).handler(({ id }) =>
    jsonResponse({ id }),
);

test("handler echoes the id", async () => {
    const req = HttpRequest.builder().uri(new URL("http://localhost/?id=5")).body(null);

    const res = TestResponse.from(await myHandler(req));

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: "5" });
});
```

`TestResponse.from()` accepts everything a handler may return: an `HttpResponse`, a string, a status/body tuple, and
so on.

## Configuring the client

The client fills in everything `serve()` would derive from a real connection. All of it is configurable:

```ts
import { ExtensionKey, Extensions } from "@taxum/core/http";
import { testClient } from "@taxum/testing";

const CURRENT_USER = new ExtensionKey<{ id: number }>("Current user");

const extensions = new Extensions();
extensions.insert(CURRENT_USER, { id: 1 });

const client = testClient(router, {
    baseUri: "https://api.example.com",
    clientIp: "203.0.113.7",
    extensions,
});
```

- `baseUri` supplies the request URI's protocol, host, and port, plus the injected `host` header. Its path component
  is ignored; request paths are absolute and must start with `/`. Defaults to `http://localhost/`.
- `clientIp` becomes the `CONNECT_INFO` extension, so [client-IP middleware](/guide/middleware/client-ip) works
  unchanged. Defaults to `127.0.0.1`. A per-request override is available as `.clientIp()`.
- `extensions` is a template of [extensions](/guide/core-concepts/extensions) applied to every request, e.g. to seed
  a fake auth context instead of running an authentication layer. Per-request `.extension()` calls override it.

The client also injects inert `DISCONNECT_SIGNAL` and `SHUTDOWN_SIGNAL` extensions on every request (see
[Graceful Shutdown](/guide/core-concepts/graceful-shutdown#disconnect-signal)), so handlers that read them behave
normally. To test disconnect handling deterministically, pass your own signal:

```ts
const disconnect = new AbortController();

const res = await client.get("/stream").disconnectSignal(disconnect.signal);
disconnect.abort();
```

## Cookies

Every client owns a cookie jar at `client.cookies`, pairing naturally with [`@taxum/cookie`](/guide/addons/cookie)
on the server side. With `saveCookies: true`, `set-cookie` response headers are captured automatically and matching
cookies accompany later requests, so session flows test end to end:

```ts
const client = testClient(router, { saveCookies: true });

await client.post("/login").form({ user: "ben", password: "secret" });
const res = await client.get("/me");

assert.equal(res.status, 200);
assert.equal(client.cookies.get("session")?.httpOnly, true);
```

The jar honors `Path`, `Expires`, and `Max-Age`. It can be seeded and inspected directly, which works regardless of
`saveCookies` (the option only gates automatic capture):

```ts
client.cookies.set("session", sessionValue);
client.cookies.set({ name: "consent", value: "yes", path: "/legal" });
```

When one client spans multiple tests, `client.cookies.clear()` resets the jar between them.

::: warning Secure cookies need an https base URI
The jar withholds `Secure` cookies from `http` URIs, just like a real client. With the default
`http://localhost/` base URI, a `Secure` session cookie is stored but never sent, and every authenticated request
fails. Use `baseUri: "https://localhost/"` when your app marks its cookies `Secure`.
:::

## Server-Sent Events

`sseEvents()` consumes an [SSE](/guide/core-concepts/sse) response as an async iterator of `SseEvent` objects. Multi-line `data:` fields are
reassembled, and `event`, `id`, and `retry` are surfaced:

```ts
const res = await client.get("/events");

for await (const event of res.sseEvents()) {
    assert.equal(event.event, "tick");
    assert.match(event.data ?? "", /Counter/);
    break;
}
```

Breaking out of the loop cancels the response stream, which the handler observes like a client disconnect: an async
generator's `finally` block runs, and keep-alive timers are cleared. This makes cleanup behavior testable without a
real socket.

Comment lines, including keep-alive pings, are skipped by default. Pass `{ comments: true }` to assert on them:

```ts
for await (const event of res.sseEvents({ comments: true })) {
    // keep-alive pings arrive as { comment: "" }
}
```

`sseEvents()` consumes the body as a stream and is therefore mutually exclusive with `text()`/`json()`: whichever is
used first claims the body.

## What stays outside

The client covers everything behind the `Service` interface, which is where all routing, extraction, and middleware
lives. A thin layer only runs on a real connection: `trustProxy` handling of `X-Forwarded-*` headers, the
Host-injection guard, and response framing such as `transfer-encoding: chunked`. That layer is exercised by taxum's
own test suite, not by yours. If you need to test against that layer explicitly, start a real server with `serve()` on port 0
and use `fetch`.
