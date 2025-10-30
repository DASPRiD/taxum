---
description: How to create and read cookies.
---

# Cookie Management

Taxum provides cookie parsing and management via `@taxum/cookie`. It integrates seamlessly with extractors, allowing you
to read, modify, sign, and encrypt cookies.

Cookies can be used in three main ways:

- **Normal cookies**: stored and sent as-is; readable and writable by the client.
- **Signed cookies**: ensure integrity and authenticity; clients can see the value but cannot tamper with it.
- **Private cookies**: encrypted and authenticated; clients cannot read or modify the contents.

## Installation

::: code-group

```sh [npm]
$ npm add @taxum/cookie
```

```sh [pnpm]
$ pnpm add @taxum/cookie
```

```sh [yarn]
$ yarn add @taxum/cookie
```

```sh [bun]
$ bun add @taxum/cookie
```

:::

## Examples

### Basic usage

Use the `cookieJar` extractor to read and modify cookies inside a handler. Any modified cookies will be written back as
`Set-Cookie` headers in the response.

```ts
import { cookieJar, Cookie } from "@taxum/cookie";
import { extractHandler } from "@taxum/core/routing";

const handler = extractHandler(cookieJar, (jar) => {
    // Add a cookie
    jar.add(new Cookie("foo", "bar"));

    // Read cookies
    console.log(jar.get("foo")?.value);

    return [jar, "ok"];
});
```

### Removing cookies

Calling `.remove()` will generate a "removal cookie" (empty value, expired) in the response.

```ts
import { cookieJar, Cookie } from "@taxum/cookie";
import { extractHandler } from "@taxum/core/routing";

const handler = extractHandler(cookieJar, (jar) => {
    jar.remove(new Cookie("foo"));

    return [jar, "cookie removed"];
});
```

### Signed cookies

Signed cookies ensure **integrity** and **authenticity**. Clients can read values in plaintext but cannot tamper with or
forge them.

```ts
import { generateKey } from "node:crypto";
import { cookieJar, Cookie } from "@taxum/cookie";
import { extractHandler } from "@taxum/core/routing";

const key = generateKey("hmac", { length: 512 });

const handler = extractHandler(cookieJar, (jar) => {
    const signed = jar.signed(key);

    signed.add(new Cookie("secure", "hello"));

    // Can only be verified via the signed jar
    console.log(signed.get("secure")?.value); // "hello"
    console.log(jar.get("secure")?.value);    // opaque signed value

    return [jar, "signed"];
});
```

### Private cookies

Private cookies are both **encrypted** and **authenticated**, ensuring confidentiality in addition to integrity and
authenticity.

```ts
import { generateKey } from "node:crypto";
import { cookieJar, Cookie } from "@taxum/cookie";
import { extractHandler } from "@taxum/core/routing";

const key = generateKey("aes", { length: 256 });

const handler = extractHandler(cookieJar, (jar) => {
    const priv = jar.private(key);

    priv.add(new Cookie("secret", "hidden-value"));

    // Encrypted at rest in the jar
    console.log(jar.get("secret")?.value);    // encrypted blob

    // Decrypted and verified via private jar
    console.log(priv.get("secret")?.value);   // "hidden-value"

    return [jar, "private"];
});
```
