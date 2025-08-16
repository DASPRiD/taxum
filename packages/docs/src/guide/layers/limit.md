# Request Body Limit Layer

The Request Body Limit layer enforces a maximum size for incoming HTTP request bodies. If a request exceeds the
configured size limit, it immediately responds with `413 Payload Too Large` without passing the request further into
your route handler.

## Example

```ts
import { RequestBodyLimitLayer } from "@taxum/core/layer/limit";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.post(() => "Data accepted"))
    .layer(new RequestBodyLimitLayer(1024 * 1024)); // 1MB limit
```

## How It Works

1. **Header check first**: If Content-Length is present and greater than the limit, the request is rejected before
  reading the body.
2. **Streaming enforcement**: If the body is streamed (or Content-Length is missing), the layer reads data in chunks and
  stops immediately if the limit is exceeded.

## Notes

- Applies per request, not per multipart field.
- Returns `413 Payload Too Large` for violations.
- Place before any body parsing layers to prevent loading oversized data into memory.

## Layer Ordering

Later-applied layers run first for incoming requests. When using `RequestBodyLimitLayer` together with request
decompression:

- **To limit the *uncompressed* payload size:**  
  Add `RequestBodyLimitLayer` **before** `RequestDecompressionLayer`.  
  This means decompression runs first (last in the chain), and the limit is enforced on the decompressed bytes.

- **To limit the *compressed* (on-the-wire) size:**  
  Add `RequestBodyLimitLayer` **after** `RequestDecompressionLayer`.  
  This means the limit runs before decompression and enforces the size based on the compressed stream.

### Example: Limit uncompressed payload

```ts
const router = new Router()
    .layer(new RequestBodyLimitLayer(1024 * 1024)) // runs after decompression
    .layer(new RequestDecompressionLayer());       // runs first
```

### Example: Limit compressed size

```ts
const router = new Router()
    .layer(new RequestDecompressionLayer())         // runs after limit
    .layer(new RequestBodyLimitLayer(1024 * 1024)); // runs first
```
