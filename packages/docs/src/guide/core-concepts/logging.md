# Logging

By default, all errors and warnings will be logged to the `console` as is. You might want to modify this to use your
preferred logging framework.

The logger is registered globally and has to implement a simple interface. Here's an example of how you would use
[logforth](https://github.com/dasprid/logforth) with Taxum:

```ts
import { Logger } from "logforth";
import { setGlobalLogger } from "@taxum/core/logging";

const logger = new Logger();

setGlobalLogger({
    info: (message) => logger.info(message),
    warn: (message) => logger.warn(message),
    error: (message, error) => logger.error(message, { error }),
});
```
