# Request Decompression Layer

A layer that automatically decompresses request bodies based on the `Content-Encoding` header. Supports Gzip, Deflate,
Brotli, and Zstd. 

## Example

```ts
import { RequestDecompressionLayer } from "@taxum/core/layer/decompression";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get(() => "Hello World"))
    .layer(new RequestDecompressionLayer());
```

## Configuration

All encodings are enabled by default.

### Enabling / Disabling Encodings

```ts
layer.gzip(true);     // enable gzip
layer.noGzip();       // disable gzip
layer.deflate(true);  // enable deflate
layer.noDeflate();    // disable deflate
layer.br(true);       // enable Brotli
layer.noBr();         // disable Brotli
layer.zstd(true);     // enable Zstd
layer.noZstd();       // disable Zstd
```

### Pass Through Unsupported Encodings

By default, requests with unsupported `Content-Encoding` return `415 Unsupported Media Type`. You can override this:

```ts
layer.passThroughUnaccepted(true); // continue even if encoding is unsupported
```

## How It Works

1. Checks `Content-Encoding` header of the request.
2. If encoding is supported:
    - Removes `Content-Encoding` and `Content-Length` headers.
    - Pipes the request body through the appropriate decompression stream.
3. If encoding is unsupported:
    - Returns `415` unless `passThroughUnaccepted` is enabled.
4. Passes decompressed body to inner service.

## Notes

- Decompression is applied **before** the inner service processes the request.
- Responses are unaffected; this layer only modifies the request.
