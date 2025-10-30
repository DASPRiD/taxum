---
description: Assigning a logger framework to Taxum.
---

# Logging

By default, any logs will be logged to the `console` as is. You might want to modify this to use your preferred logging
framework. This also allows you to filter out certain log levels.

## Examples

A logger proxy is registered globally and has to implement a simple interface. Here are a few examples to integrate some
logging frameworks with Taxum.

### [logforth](https://github.com/dasprid/logforth) 

```ts
import { setLoggerProxy } from "@taxum/core/logging";
import { Logger } from "logforth";

const logger = new Logger();

setLoggerProxy({
    fatal: (message, values) => logger.fatal(message, values),
    error: (message, values) => logger.error(message, values),
    warn: (message, values) => logger.warn(message, values),
    info: (message, values) => logger.info(message, values),
    debug: (message, values) => logger.debug(message, values),
    trace: (message, values) => logger.trace(message, values),
});
```

### [pino](https://github.com/pinojs/pino)

```ts
import { setLoggerProxy } from "@taxum/core/logging";
import logger from "pino";

const transformArgs = (
    message: string,
    values?: Record<string, unknown>,
): [string] | [Record<string, unknown>, string] => {
    if (!values) {
        return [message];
    }
    
    const { error, ...rest } = values;
    return [{ ...rest, err: error }, message];
};

setLoggerProxy({
    fatal: (message, values) => logger.fatal(...transformArgs(message, values)),
    error: (message, values) => logger.error(...transformArgs(message, values)),
    warn: (message, values) => logger.warn(...transformArgs(message, values)),
    info: (message, values) => logger.info(...transformArgs(message, values)),
    debug: (message, values) => logger.debug(...transformArgs(message, values)),
    trace: (message, values) => logger.trace(...transformArgs(message, values)),
});
```

### [winston](https://github.com/winstonjs/winston)

```ts
import { setLoggerProxy } from "@taxum/core/logging";
import winston from "winston";

const logger = winston.createLogger();

setLoggerProxy({
    fatal: (message, values) => logger.fatal(message, values),
    error: (message, values) => logger.error(message, values),
    warn: (message, values) => logger.warn(message, values),
    info: (message, values) => logger.info(message, values),
    debug: (message, values) => logger.debug(message, values),
    trace: (message, values) => logger.trace(message, values),
});
```
