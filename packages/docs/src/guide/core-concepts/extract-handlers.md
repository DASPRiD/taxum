# Extract Handlers

An extract handler is a special kind of request handler that allows you to automatically extract and validate pieces of
a request, such as query parameters, path parameters, headers, body content, or custom extensions. Instead of manually
parsing these values inside your handler, extract handlers let you declare exactly what you need, and they will provide
it as arguments to your handler function.

This approach makes your code cleaner, safer, and easier to maintain.

## Creating an Extract Handler

To create an extract handler, you pass extractors as positional arguments to the handler function, followed by your
handling function:

```ts
import { json, query } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";
import { z } from "zod";

const bodySchema = z.object({ name: z.string() });
const querySchema = z.object({ page: z.coerce.number().int().nonnegative() });

const myHandler = extractHandler(
    json(bodySchema),
    query(querySchema),
    (body, query) => {
        console.log(body.name, query.page);
        return { success: true };
    },
);
```

::: tip NOTE

While the examples here use positional arguments, extractors can also be provided in an array. The positional style is
recommended for most cases because it is simpler and clearer.

:::

## Built-in Extractors

Taxum comes with a number of built-in extractors that you can use to extract common pieces of a request. Whenever an
extractor requires a schema, we'll use [Zod](https://github.com/colinhacks/zod) as an example. You can use any schema
library you like that implements the [Standard Schema](https://github.com/standard-schema/standard-schema).

### `json(schema)`

Extracts and parses a JSON body according to the provided schema.

```ts
import { json } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";
import { z } from "zod";

const bodySchema = z.object({ title: z.string() });

const myHandler = e(
    json(bodySchema),
    (body) => {
        console.log(body.title);
    },
);
```

### `form(schema)`

Extracts form data either from the query string (for `GET`/`HEAD` requests) or the body (for other methods) and
validates it against a schema.

```ts
import { form } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";
import { z } from "zod";

const formSchema = z.object({ email: z.string().email() });

const myHandler = extractHandler(
    form(formSchema),
    (body) => {
        console.log(body.email);
    },
);
```

### `query(schema)`

Parses and validates query parameters.

```ts
import { query } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";
import { z } from "zod";

const paginationSchema = z.object({ page: z.coerce.number().int().nonnegative() });

const myHandler = extractHandler(
    query(paginationSchema),
    (query) => {
        console.log(query.page);
    },
);
```

### `rawQuery`

Provides the raw query parameters without validation.

```ts
import { rawQuery } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";

const myHandler = extractHandler(
    rawQuery,
    (query) => {
        console.log(query);
    },
);
```

### `pathParam(schema)` and `pathParams(schema)`

Extracts and validates path parameters. If the path only has a single parameter, you can use `pathParam` instead of
`pathParams`.

```ts
import { pathParam } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";
import { z } from "zod";

const myHandler = extractHandler(
    pathParam(z.uuid()),
    (id) => {
        console.log(id);
    },
);
```

### `header(headerName, required?)`

Extracts a header stored from the request.

```ts
import { header } from "@taxum/core/extract";
import { extractHandler } from "@taxum/core/routing";

const myHandler = extractHandler(
    header("if-none-match"),
    (etag) => {
        console.log(etag);
    },
);
```

### `extension(key, required?)`

Extracts a custom extension stored in the request.

```ts
import { extension } from "@taxum/core/extract";
import { ExtensionKey } from "@taxum/core/http";
import { extractHandler } from "@taxum/core/routing";

const MY_EXTENSION = new ExtensionKey<string>("My extension");

const myHandler = extractHandler(
    extension(MY_EXTENSION),
    (myExtension) => {
        console.log(myExtension);
    },
);
```
