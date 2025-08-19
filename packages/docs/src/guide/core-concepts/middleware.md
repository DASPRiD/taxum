# Middleware

## Intro

Taxum uses Tower-style layers to implement its middleware system. This differs from the more commonly seen approach
in JavaScript frameworks, as layers are always applied after the routes they should apply to, instead of before.

## Applying Middleware

Taxum allows you to add middleware just about anywhere:

- To entire routers with [Router.layer](/api/@taxum/core/routing/classes/Router.html#layer)
  and [Router.routeLayer](/api/@taxum/core/routing/classes/Router.html#routeLayer)
- To method routers with [MethodRouter.layer](/api/@taxum/core/routing/classes/MethodRouter.html#layer)

When middleware is added at any point, Taxum will automatically wrap it with two additional layers:

- A layer which converts any `HttpResponseLike` value into an `HttpResponse`.
- A layer which converts any thrown errors into an `HttpResponse`.

## Applying Multiple Middleware

It's recommended to use [ServiceBuilder](/api/@taxum/core/middleware/builder/classes/ServiceBuilder.html) to apply
multiple middleware at once, instead of calling `layer` (or `routeLayer`) repeatedly:

```ts
import { ServiceBuilder } from '@taxum/core/middleware/builder';
import { m, Router } from '@taxum/core/routing';

const router = new Router()
    .route("/", m.get(() => "Hello world"))
    .layer(
        ServiceBuilder.create()
            .compression()
            .traceHttp()
            .catchError()
            .requestBodyLimit(1024 * 1024)
    );
```

## Ordering

When you add middleware with `Router.layer` (or similar), all previously added routes will be wrapped in the middleware.
Generally speaking, this results in middleware being executed from bottom to top.

So if you do this:

```ts
import { m, Router } from '@taxum/core/routing';

const router = new Router()
    .route("/", m.get(() => "Hello world"))
    .layer(layerOne)
    .layer(layerTwo)
    .layer(layerThree);
```

Think of the middleware as being layered like an onion where each new layer wraps all previous layers:

```mermaid
flowchart TD
    requests[Requests] --> L3
    subgraph L3[Layer Three]
        subgraph L2[Layer Two]
            subgraph L1[Layer One]
                handler[Handler]
            end
        end
    end
    L3 --> responses[Responses]
```

That is:

- First `layerThree` receives the request.
- It then does its thing and passes the request onto `layerTwo`.
- Which passes the request onto `layerOne`.
- Which passes the request onto the handler where a response is produced.
- That response is then passed to `layerOne`.
- Then to `layerTwo`.
- And finally to `layerThree` where it's returned out of your app.

It's a little more complicated in practice because any middleware is free to return early and not call the next layer,
for example, if a request cannot be authorized, but it's a useful mental model to have.

As previously mentioned, it's recommended to add multiple middleware using `ServiceBuilder`, however this impacts
ordering:

```ts
import { ServiceBuilder } from '@taxum/core/middleware/builder';
import { m, Router } from '@taxum/core/routing';

const router = new Router()
    .route("/", m.get(() => "Hello world"))
    .layer(
        ServiceBuilder.create()
            .withLayer(layerOne)
            .withLayer(layerTwo)
            .withLayer(layerThree)
    );
```

`ServiceBuilder` works by composing all layers into one such that they run top to bottom. So with the previous code,
`layerOne` would receive the request first, then `layerTwo`, then `layerThree`, then `handler`. Then the response would
bubble back up through `layerThree`, then `layerTwo` and finally `layerOne`.

Executing middleware top to bottom is generally easier to understand and follow mentally which is one of the reasons
`ServiceBuilder` is recommended.

## Writing Middleware

Taxum offers many ways of writing middleware, at different levels of abstraction and with different pros and cons.

### `@taxum/core/middleware/from-fn/fromFn`

This is the simplest and most familiar way of writing middleware. You pass in a function which receives the request and
the next service in line:

```ts
import { fromFn } from '@taxum/core/middleware/from-fn';
import { m, Router } from '@taxum/core/routing';

const router = new Router()
    .route("/", m.get(() => "Hello world"))
    .layer(fromFn(async (req, next) => {
        // Do something with the request
        const res = await next.invoke(req);
        // Do something with the response
        
        return res;
    }));
```

### `@taxum/core/layer/layerFn`

If you have a service written as a class implementing [Service](/api/@taxum/core/service/type-aliases/Service.html), you
can use [layerFn](/api/@taxum/core/layer/classes/LayerFn.html) to turn it into a layer:

```ts
import type { HttpRequest, HttpResponse } from "@taxum/core/http";
import { layerFn } from '@taxum/core/layer';
import { m, Router } from '@taxum/core/routing';
import type { HttpService } from '@taxum/core/service';

class MyService implements HttpService {
    public constructor(private readonly inner: HttpService) {
    }

    async invoke(req: HttpRequest): Promise<HttpResponse> {
        // Do something with the request
        const res = await next.invoke(req);
        // Do something with the response

        return res;
    }
}

const router = new Router()
    .route("/", m.get(() => "Hello world"))
    .layer(layerFn((inner) => new MyService(inner)));
```

This allows you to have a service defined once and add configuration to it at the point of usage, e.g., when you are
using the middleware in different places.

### `@taxum/core/layer/Layer`

The most complex approach is to write a class implementing [Layer](/api/@taxum/core/layer/type-aliases/Layer.html):

```ts
import type { HttpRequest, HttpResponse } from "@taxum/core/http";
import type { HttpLayer } from '@taxum/core/layer';
import { m, Router } from '@taxum/core/routing';
import type { HttpService } from '@taxum/core/service';

class MyService implements HttpService {
    public constructor(private readonly inner: HttpService) {
    }

    async invoke(req: HttpRequest): Promise<HttpResponse> {
        // Do something with the request
        const res = await next.invoke(req);
        // Do something with the response

        return res;
    }
}

class MyLayer implements HttpLayer {
    public layer(inner: HttpService): HttpService {
        return new MyService(inner);
    }
}

const router = new Router()
    .route("/", m.get(() => "Hello world"))
    .layer(new MyLayer());
```

By defining your own layer class, you can add logic to the creation of the service while also accepting configuration
at the point of usage.
