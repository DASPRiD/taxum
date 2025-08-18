# CORS Middleware

A middleware that sets CORS headers on responses, including support for preflight requests (OPTIONS) and fine-grained
control over allowed origins, methods, headers, credentials, and caching.

## Example

```ts
import { CorsLayer } from "@taxum/core/middleware/cors";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get(() => "Hello World"))
    .layer(CorsLayer.permissive());
```

## Presets

- `permissive()`: Allows all headers, methods, origins, and exposes all headers.
- `veryPermissive()`: Additionally allows credentials and mirrors request methods, headers, and origin.

## Configuration

The `CorsLayer` allows fine-grained CORS control via chainable methods. Each method corresponds to one or more HTTP
headers.

### allowCredentials()

Sets `Access-Control-Allow-Credentials`.

#### Possible values

- **`true`**  
  Allow credentials for all requests.

- **`false`**  
  Allow credentials for no requests.

- **Predicate function `(origin: string, parts: Parts) => boolean`**  
  Dynamically allow credentials per request. Return `true` to allow, `false` to deny.

::: tip WARNING

When `allowCredentials` is set to `true`, you cannot use `ANY` for `Allow-Origin`, `Allow-Headers`, `Allow-Methods`, or
`Expose-Headers`.

:::

### allowHeaders()

Sets `Access-Control-Allow-Headers`.

#### Possible values

- **`null`**  
  Allow no headers.

- **`ANY`**  
  Allow any headers by sending a wildcard (`*`).

- **`MIRROR_REQUEST`**  
  Allow any headers by mirroring the preflight `Access-Control-Request-Headers` header.

- **Array of strings**  
  Allows a list of headers.

### allowMethods()

Sets `Access-Control-Allow-Methods`.

#### Possible values

- **`null`**  
  Allow no methods.

- **`ANY`**  
  Allow any methods by sending a wildcard (`*`).

- **`MIRROR_REQUEST`**  
  Allow any methods by mirroring the preflight `Access-Control-Request-Method` header.

- **Single method** (`string` or `Method`)  
  Allow a single HTTP method.

- **Array of methods** (`(string | Method)[]`)  
  Allow a list of HTTP methods.

### allowOrigin()

Sets `Access-Control-Allow-Origin`.

#### Possible values

- **`ANY`**  
  Allow any origin by sending a wildcard (`*`).

- **`MIRROR_REQUEST`**  
  Allow the request origin by mirroring the `Origin` header.

- **Single origin** (`string`)  
  Allow a single origin.

- **Array of origins** (`string[]`)  
  Allow a list of origins. (Cannot include `*`)

- **Predicate** (`(origin: string, parts: Parts) => boolean | Promise<boolean>`)  
  Allow origins dynamically based on a custom function.

### allowPrivateNetwork()

Sets `Access-Control-Allow-Private-Network` for private network requests.

#### Possible values

- **`true`**  
  Allow all private network requests.

- **`false`**  
  Disallow private network requests.

- **Predicate** (`(origin: string, parts: Parts) => boolean`)  
  Allow private network requests dynamically based on a custom function.

### exposeHeaders()

Sets `Access-Control-Expose-Headers`.

#### Possible values

- **`null`**  
  Expose no headers.

- **`"*"`**  
  Expose all headers.

- **Array of strings** (`string[]`)  
  Expose a list of headers.

### maxAge()

Sets `Access-Control-Max-Age` for preflight caching.

#### Possible values

- **`null`**  
  Disable the `Access-Control-Max-Age` header.

- **`number`**  
  Set a fixed maximum age (in seconds).

- **Function `(origin, parts) => number`**  
  Dynamically determine the maximum age based on the request.

### vary()

Sets `Vary` headers.

#### Possible values

- **`string[]`**  
  A list of headers to include in the `Vary` header.  
  Defaults to `PREFLIGHT_REQUEST_HEADERS`.

## How It Works

1. Checks `Origin` header from the request.
2. Sets standard CORS headers depending on the request method:
   - `OPTIONS` (preflight): sets `Allow-Methods`, `Allow-Headers`, `Max-Age`, `Allow-Origin`.
   - Other methods: sets `Expose-Headers` and `Allow-Origin`.
3. Integrates with inner services: merges headers into inner response.
4. Supports async evaluation of origin (function-based).
