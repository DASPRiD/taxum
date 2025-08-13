---
title: Extensions
---

# Extensions

Taxum allows keeping track of state within the request lifecycle through extensions. Extensions are typed values on the
`HttpRequest` (to carry state for downstream services) and `HttpResponse` (to carry state for upstream services).

A few of the standard layers make use of extensions to provide state to your handlers, e.g. the
{@link @taxum/core!layer/client-ip | Client IP layer}. You can easily define your own extensions like this:

```ts
import { ExtensionKey } from "@taxum/core/http";

const MY_EXTENSION = new ExtensionKey<string>();
```

The type parameter you use during construction ensures that only those values can be set and retrieved. You can insert
extension values at any point you have access to a request or response:

```ts
req.extensions.insert(MY_EXTENSION, "foo");
```

To retrieve extensions, you can either get them directly from the request (or response), or you can use the
{@link @taxum/core!extract.extension | extension} extractor in your handlers.
