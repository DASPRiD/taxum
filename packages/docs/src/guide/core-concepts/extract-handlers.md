# Extract Handlers

An extract handler is a special kind of request handler that allows you to automatically extract and validate pieces of
a request, such as query parameters, path parameters, headers, body content, or custom extensions. Instead of manually
parsing these values inside your handler, extract handlers let you declare exactly what you need, and they will provide
it as arguments to your handler function.

This approach makes your code cleaner, safer, and easier to maintain.

## Creating an Extract Handler

To create an extract handler, use the `createExtractHandler` function. You provide one or more extractors and then call
`.handler(...)` to supply the handling function:

```ts
import { json, query } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { z } from "zod";

const bodySchema = z.object({ name: z.string() });
const querySchema = z.object({ page: z.coerce.number().int().nonnegative() });

const myHandler = createExtractHandler(
    json(bodySchema),
    query(querySchema),
).handler((body, query) => {
    console.log(body.name, query.page);
});
```

## Built-in Extractors

Taxum comes with a number of built-in extractors that you can use to extract common pieces of a request. Whenever an
extractor requires a schema, we'll use [Zod](https://github.com/colinhacks/zod) as an example. You can use any schema
library you like that implements the [Standard Schema](https://github.com/standard-schema/standard-schema).

### `json(schema)`

Extracts and parses a JSON body according to the provided schema.

```ts
import { json } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { z } from "zod";

const bodySchema = z.object({ title: z.string() });

const myHandler = createExtractHandler(
    json(bodySchema),
).handler((body) => {
    console.log(body.title);
});
```

### `form(schema)`

Extracts form data either from the query string (for `GET`/`HEAD` requests) or the body (for other methods) and
validates it against a schema.

```ts
import { form } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { z } from "zod";

const formSchema = z.object({ email: z.string().email() });

const myHandler = createExtractHandler(
    form(formSchema),
).handler((body) => {
    console.log(body.email);
});
```

### `query(schema)`

Parses and validates query parameters.

```ts
import { query } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { z } from "zod";

const paginationSchema = z.object({ page: z.coerce.number().int().nonnegative() });

const myHandler = createExtractHandler(
    query(paginationSchema),
).handler((query) => {
    console.log(query.page);
});
```

### `rawQuery`

Provides the raw query parameters without validation.

```ts
import { rawQuery } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";

const myHandler = createExtractHandler(
    rawQuery,
).handler((query) => {
    console.log(query);
});
```

### `pathParam(schema)` and `pathParams(schema)`

Extracts and validates path parameters. If the path only has a single parameter, you can use `pathParam` instead of
`pathParams`.

```ts
import { pathParam } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";
import { z } from "zod";

const myHandler = createExtractHandler(
    pathParam(z.uuid()),
).handler((id) => {
    console.log(id);
});
```

### `header(headerName, required?)`

Extracts a header stored from the request.

```ts
import { header } from "@taxum/core/extract";
import { createExtractHandler } from "@taxum/core/routing";

const myHandler = createExtractHandler(
    header("if-none-match"),
).handler((etag) => {
    console.log(etag);
});
```

### `extension(key, required?)`

Extracts a custom extension stored in the request.

```ts
import { extension } from "@taxum/core/extract";
import { ExtensionKey } from "@taxum/core/http";
import { createExtractHandler } from "@taxum/core/routing";

const MY_EXTENSION = new ExtensionKey<string>("My extension");

const myHandler = createExtractHandler(
    extension(MY_EXTENSION),
).handler((myExtension) => {
    console.log(myExtension);
});
```
