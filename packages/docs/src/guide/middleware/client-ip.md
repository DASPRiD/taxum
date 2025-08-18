# Client IP Middleware

The Client IP middleware extracts the originating IP address of an incoming HTTP request and stores it in the request
extensions under the `CLIENT_IP` key. This allows later middleware or route handlers to access the client IP without
reparsing headers.

## Example

```ts
import { SetClientIpLayer, CLIENT_IP } from "@taxum/core/middleware/client-ip";
import { m, Router } from "@taxum/core/routing";

const router = new Router()
    .route("/", m.get((req) => {
        const ip = req.extensions.get(CLIENT_IP);
        return `Hello from ${ip}`;
    }))
    .layer(new SetClientIpLayer(true)); // trust proxy headers
```

## How It Works

1. If `trustProxy` is **false** (default), the layer uses the direct remote address from the request.
2. If `trustProxy` is **true**, the layer checks the `X-Forwarded-For` header and returns the first valid IP.
3. If no valid proxy header is found, the remote address is used as a fallback.

## Notes

- Returns only a single IP string.
- Should be applied **after** any rate-limiting or logging layers that rely on the client IP.
- If behind multiple proxies, make sure your trusted proxy chain is properly configured, otherwise spoofed
  `X-Forwarded-For` headers could be used.

## Layer Ordering

Later-applied layers wrap earlier ones, so they run first for incoming requests.

To ensure other layers (like logging or rate-limiting) can access the client IP, `SetClientIpLayer` should be applied
**after** them:

```ts
const router = new Router()
    .layer(new RequestLoggerLayer())    // runs second
    .layer(new SetClientIpLayer(true)); // runs first, sets `CLIENT_IP`
```
