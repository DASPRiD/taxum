---
title: Error Handling
---

# Error Handling

In Taxum, errors are handled after every registered layer and handler. The default behavior is as follows:

- Any error that implements {@link @taxum/core!http.ToHttpResponse | ToHttpResponse} will be converted to a response
  and returned as is.
- Any other error will be converted to an empty `500` response.
- Any error that results in a `5xx` response will be logged through the global logger.

To customize this behavior, you can define your own error handler. An error handler is simply a function that receives
the thrown error and returns an `HttpResponse`. Error handlers are registered globally per router:

```ts
import { HttpResponse, StatusCode } from "@taxum/core/http";
import type { ErrorHandler } from "@taxum/core/routing";

router.errorHandler((error: unknown): HttpResponse => {
    return HttpResponse.builder()
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .body("Something went wrong!");
});
```
