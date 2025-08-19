import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    getLoggerProxy,
    type LogFnProxy,
    type LoggerProxy,
    resetLoggerProxy,
    setLoggerProxy,
} from "../../src/logging/index.js";

const noopLog: LogFnProxy = () => {
    // noop
};

describe("logging:index", () => {
    it("default logger calls console methods", async (t) => {
        const errorSpy = t.mock.method(console, "error", () => {
            // noop
        });
        const warnSpy = t.mock.method(console, "warn", () => {
            // noop
        });
        const infoSpy = t.mock.method(console, "info", () => {
            // noop
        });
        const debugSpy = t.mock.method(console, "debug", () => {
            // noop
        });
        const traceSpy = t.mock.method(console, "trace", () => {
            // noop
        });

        const logger = getLoggerProxy();
        const error = new Error("fail");
        logger.fatal("fatal message");
        logger.error("error message", { error });
        logger.warn("warn message");
        logger.info("info message");
        logger.debug("debug message");
        logger.trace("trace message");

        assert.deepEqual(errorSpy.mock.calls[0].arguments, ["fatal message", undefined]);
        assert.deepEqual(errorSpy.mock.calls[1].arguments, ["error message", { error }]);
        assert.deepEqual(warnSpy.mock.calls[0].arguments, ["warn message", undefined]);
        assert.deepEqual(infoSpy.mock.calls[0].arguments, ["info message", undefined]);
        assert.deepEqual(debugSpy.mock.calls[0].arguments, ["debug message", undefined]);
        assert.deepEqual(traceSpy.mock.calls[0].arguments, ["trace message", undefined]);
    });

    it("setGlobalLogger replaces the global logger", () => {
        let called = false;

        const customLogger: LoggerProxy = {
            fatal: noopLog,
            error: (message, values) => {
                called = true;
                assert.equal(message, "custom error");
                assert(values && values.error instanceof Error);
            },
            warn: noopLog,
            info: noopLog,
            debug: noopLog,
            trace: noopLog,
        };

        setLoggerProxy(customLogger);
        const logger = getLoggerProxy();

        logger.error("custom error", { error: new Error("err") });
        assert(called);
    });

    it("resetGlobalLogger restores the default logger", async (t) => {
        const infoSpy = t.mock.method(console, "info", () => {
            // noop
        });

        setLoggerProxy({
            fatal: noopLog,
            error: noopLog,
            warn: noopLog,
            info: noopLog,
            debug: noopLog,
            trace: noopLog,
        });

        resetLoggerProxy();

        const logger = getLoggerProxy();
        logger.info("error message after reset");

        assert.deepEqual(infoSpy.mock.calls[0].arguments, ["error message after reset", undefined]);
    });
});
