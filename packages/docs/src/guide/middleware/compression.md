---
description: Compress responses based on the Accept-Encoding header. 
---

# Response Compression Middleware

A middleware that compresses response bodies based on the `Accept-Encoding` header, supporting multiple algorithms
including Gzip, Deflate, Brotli, and Zstd. Adds the corresponding `Content-Encoding` header to responses.

## Example

```ts
import { ResponseCompressionLayer } from "@taxum/core/middleware/compression";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get(() => "Hello World"))
    .layer(new ResponseCompressionLayer());
```

## Configuration

All encodings are enabled by default with their default quality.

### Enabling / Disabling Encodings

```ts
layer.gzip(true)      // enable gzip
layer.noGzip()        // disable gzip
layer.br(true)        // enable Brotli
layer.noBr()          // disable Brotli
```

### Compression Level

Determines the quality and speed of compression. Supports:

- `"fastest"`: Fastest compression, larger output.
- `"best"`: Best compression, slower.
- `"default"`: Algorithm-defined default.
- `number`: Custom level (algorithm-specific).

```ts
layer.quality("best"); // Use best quality
layer.quality(5);      // Custom numeric level
```

### Predicates

A predicate function determines whether a response should be compressed.

```ts
type Predicate = (response: HttpResponse) => boolean;
```

You can set a custom predicate:

```ts
layer.compressWhen((res) => res.headers.get("content-type")?.startsWith("text/"));
```

#### Built-in Predicate Helpers

- **andPredicate**: Combine multiple predicates with logical AND.
- **sizeAbovePredicate(minSize)**: Only compress responses above a given size.
- **notForContentTypePredicate(contentType, exception?)**: Skip compression for certain content types.

### Default Predicate

The default predicate compresses responses unless:

- The content-type is `application/grpc`.
- The content-type starts with `image/`, except `image/svg+xml`.
- The content-type is `text/event-stream`.
- The response size is less than 32 bytes.

## How It Works

1. Determines the preferred encoding from the request's `Accept-Encoding`.
2. Checks whether compression should be applied using the predicate.
3. Updates headers:
    - Adds `Content-Encoding`.
    - Removes `Content-Length` and `Accept-Ranges`.
    - Ensures `Vary: Accept-Encoding`.
4. Pipes the response body through the selected compressor.

## Layer Ordering

You should apply this layer after every other layer to ensure that any responses created by prior layers are compressed.

## Notes

- Responses already compressed (i.e., with a `Content-Encoding` header) are never recompressed.
- Partial responses (`Content-Range`) are not compressed.
- Predicates are fully customizable and combinable.
