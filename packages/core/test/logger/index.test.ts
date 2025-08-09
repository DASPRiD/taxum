import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    getGlobalLogger,
    type Logger,
    resetGlobalLogger,
    setGlobalLogger,
} from "../../src/logger/index.js";

describe("logger module", () => {
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

        const logger = getGlobalLogger();
        const err = new Error("fail");
        logger.error("error message", err);
        logger.warn("warn message");
        logger.info("info message");

        assert.deepEqual(errorSpy.mock.calls[0].arguments, ["error message", err]);
        assert.deepEqual(warnSpy.mock.calls[0].arguments, ["warn message"]);
        assert.deepEqual(infoSpy.mock.calls[0].arguments, ["info message"]);
    });

    it("setGlobalLogger replaces the global logger", () => {
        let called = false;
        const customLogger: Logger = {
            error: (msg, err) => {
                called = true;
                assert.equal(msg, "custom error");
                assert(err instanceof Error);
            },
            warn: (msg) => {
                called = true;
                assert.equal(msg, "custom warn");
            },
            info: (msg) => {
                called = true;
                assert.equal(msg, "custom info");
            },
        };

        setGlobalLogger(customLogger);
        const logger = getGlobalLogger();

        logger.error("custom error", new Error("err"));
        logger.warn("custom warn");
        logger.info("custom info");
        assert.ok(called);
    });

    it("resetGlobalLogger restores the default logger", async (t) => {
        const errorSpy = t.mock.method(console, "error", () => {
            // noop
        });

        setGlobalLogger({
            error: () => {
                throw new Error("should not be called");
            },
            warn: () => {
                // noop
            },
            info: () => {
                // noop
            },
        });

        resetGlobalLogger();

        const logger = getGlobalLogger();
        const err = new Error("fail");
        logger.error("error message after reset", err);

        assert.deepEqual(errorSpy.mock.calls[0].arguments, ["error message after reset", err]);
    });
});
