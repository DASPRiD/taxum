---
title: Authentication
---

# Authentication

Taxum comes with JWT authentication built-in, powered by [jose](https://github.com/panva/jose).

In most cases you'll have an identity provider which has its keys available via JWKSets. The following example
demonstrates integration with Auth0:

```ts
import { m, Router } from "@taxum/core/routing"
import { JwtLayer } from "@taxum/jwt"
import { createRemoteJWKSet } from "jose"

const jwtLayer = new JwtLayer(createRemoteJWKSet(
    new URL("https://{yourDomain}/.well-known/jwks.json"))
)
    .verifyOptions({
        issuer: "https://{yourDomain}/",
        audience: "https://{yourApi}/"
    });

const router = new Route()
    .route("/protected", m.get(() => "protected"))
    .layer(jwtLayer)
    .route("/unprotected", m.get(() => "unprotected"));
```

Protected routes have access to the JWT payload via an extension key:

```ts
import { extractHandler } from "@taxum/core/routing";
import { extension } from "@taxum/core/extract";
import { JWT } from "@taxum/jwt";

const myHandler = extractHandler(
    extension(JWT, true),
    (jwt) => {
        console.log(jwt.protectedHeader);
        console.log(jwt.payload);
    },
)
```

You can also allow the JWT layer to pass through unauthorized requests. In that case the JWT extension will not be set
if the authorization failed. To allow for that, set the `required` flag on the `extension` extractor to `false`.
