---
title: Layering
---

# Layering

Layering it Taxum's approach to middlewares. In contrast to other frameworks, layers are defined from the inside-out
instead of outside-in.

When layering a router or a method router, the layers are always applied to the already registered endpoints. Endpoints
registered after applying a layer will not be layered. This gives you fine-grained control about which layers should
be applied to which routes. This becomes especially powerful with [router nesting](./nesting.md).

It's important to consider the order you apply layers to your routes. For instance, a compression or decompression layer
should always be one of the outermost layers, so that every response and request gets compressed/decompressed before
reaching their target.

Additionally, the router allows you to either apply layers to just normal endpoints or to all endpoints including
not found fallbacks.

## Standard Layers

Taxum comes with a collection of standard layers which are generally used in most standard applications. Most notably:

- {@link @taxum/core!layer/compression.ResponseCompressionLayer | Response Compression}
- {@link @taxum/core!layer/decompression.RequestDecompressionLayer | Request Decompression}
- {@link @taxum/core!layer/cors.CorsLayer | CORS}
- {@link @taxum/core!layer/limit.RequestBodyLimitLayer | Request Body Limit}
- {@link @taxum/core!layer/client-ip.SetClientIpLayer | Client IP}
- {@link @taxum/core!layer/request-id | Request ID}
