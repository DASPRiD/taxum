# Set Header Middleware

The set header middleware allows you to insert, override, or append HTTP headers on both incoming requests and
outgoing responses. This makes it easy to enforce consistent headers (like `Content-Type`, `Cache-Control`,
or custom metadata) across your services.

All layers support three modes:

- Override: Replaces any existing values.
- Append: Adds a new value, preserving existing ones.
- IfNotPresent: Only inserts the value if no header is already set.

Values can either be a string, `null` or a function which receives the current request or response and returns a string
or `null`.

## Layers

### `SetRequestHeaderLayer`

This layer modifies headers on the incoming request before it is passed to your handler.

```ts
import { SetRequestHeaderLayer } from "@taxum/core/middleware/set-header";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get((req) => "Hello World"))
    .layer(SetRequestHeaderLayer.overriding("X-Env", "production"));
```

::: tip NOTE
When you provide a function, it receives the current HttpRequest and may return a string or null. Returning null
prevents the header from being modified.
:::

### `SetResponseHeaderLayer`

This layer modifies headers on the outgoing response before it is returned to the client.

```ts
import { SetResponseHeaderLayer } from "@taxum/core/middleware/set-header";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get(() => "Hello World"))
    .layer(SetResponseHeaderLayer.ifNotPresent("X-Powered-By", "Taxum"));
```

::: tip NOTE
When you provide a function, it receives the current HttpResponse and may return a string or null. Returning null
prevents the header from being modified.
:::

## Examples

### Appending Multiple Values

You can append headers to allow multiple values:

```ts
router.layer(SetResponseHeaderLayer.appending("Cache-Control", "public"));
router.layer(SetResponseHeaderLayer.appending("Cache-Control", "max-age=60"));
```

This produces:

```
Cache-Control: public
Cache-Control: max-age=60
```

### Dynamic Header Values

Generate values dynamically from the request or response:

```ts
router.layer(SetRequestHeaderLayer.overriding(
    "X-Trace",
    (req) => req.extensions.get("trace-id") ?? "none"
));
```

## Usage Notes

- **Order Matters**: Layers are applied in the order they are added. For example, appending and then overriding the same
  header will result in only the overridden value being present.
- **Null Handling**: Returning or passing null as a value means the header will not be modified.
- **Multiple Values**: Use appending mode to accumulate multiple values for the same header key.
- **Consistency**: These layers ensure that headers are consistently set, making them useful for enforcing
  cross-cutting concerns like security headers, caching, or service metadata.
