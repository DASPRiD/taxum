import type { TestClient } from "../src/index.js";

/**
 * Compile-time contract of the `TestRequest<BodySet>` type: once a body
 * setter has been called, the body setters disappear from the type.
 *
 * These functions are never invoked; `tsc --noEmit` validates that every
 * `@ts-expect-error` line fails to compile and every other line compiles.
 */

export const chainableAfterBody = (client: TestClient): void => {
    void client.post("/").json({}).header("x-a", "1").query({ a: "1" });
    void client.post("/").header("x-a", "1").json({});
    void client.post("/").form({ a: "1" }).cookie("session", "abc");
    void client.post("/").body("raw").extension;
};

export const noSecondBody = (client: TestClient): void => {
    // @ts-expect-error a second body must not type-check
    void client.post("/").json({}).body("again");

    // @ts-expect-error a second body must not type-check
    void client.post("/").json({}).form({ a: "1" });

    // @ts-expect-error a second body must not type-check
    void client.post("/").body("raw").json({});

    // @ts-expect-error a second body must not type-check
    void client.post("/").form({ a: "1" }).header("x-a", "1").body("late");
};
