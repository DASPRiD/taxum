import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { z } from "zod";
import { InvalidPathParamsError, pathParam, pathParams } from "../../src/extract/index.js";
import { HttpRequest, StatusCode, TO_HTTP_RESPONSE } from "../../src/http/index.js";
import { PATH_PARAMS } from "../../src/routing/index.js";

describe("extract:path", () => {
    describe("pathParam", () => {
        const schema = z.coerce.number().int().positive();

        it("parses valid path parameter", async () => {
            const req = HttpRequest.builder().extension(PATH_PARAMS, { userId: "42" }).body(null);

            const extract = pathParam(schema);
            const result = await extract(req);

            assert.equal(result, 42);
        });

        it("throws assertion error if path params extension is missing", async () => {
            const req = HttpRequest.builder().body(null);

            const extract = pathParam(schema);

            await assert.rejects(
                async () => extract(req),
                (err: unknown) => {
                    assert.ok(err instanceof assert.AssertionError);
                    assert.match((err as Error).message, /Path params not found/);
                    return true;
                },
            );
        });

        it("throws assertion error if path params have more than one value", async () => {
            const req = HttpRequest.builder()
                .extension(PATH_PARAMS, { userId: "42", clientId: "69" })
                .body(null);

            const extract = pathParam(schema);

            await assert.rejects(
                async () => extract(req),
                (err: unknown) => {
                    assert.ok(err instanceof assert.AssertionError);
                    assert.match((err as Error).message, /Path params must have exactly one value/);
                    return true;
                },
            );
        });

        it("throws InvalidPathParamsError for invalid path param", async () => {
            const req = HttpRequest.builder().extension(PATH_PARAMS, { userId: "-10" }).body(null);

            const extract = pathParam(schema);

            await assert.rejects(
                async () => extract(req),
                (err: unknown) => {
                    assert(err instanceof InvalidPathParamsError);
                    assert(Array.isArray(err.issues));
                    assert(err.issues.length > 0);
                    assert(err.issues[0].path[0] === "userId");
                    return true;
                },
            );
        });
    });

    describe("pathParams", () => {
        const schema = z.object({
            userId: z.coerce.number().int().positive(),
        });

        it("parses valid path parameters", async () => {
            const req = HttpRequest.builder().extension(PATH_PARAMS, { userId: "42" }).body(null);

            const extract = pathParams(schema);
            const result = await extract(req);

            assert.deepEqual(result, { userId: 42 });
        });

        it("throws assertion error if path params extension is missing", async () => {
            const req = HttpRequest.builder().body(null);

            const extract = pathParams(schema);

            await assert.rejects(
                async () => extract(req),
                (err: unknown) => {
                    assert(err instanceof assert.AssertionError);
                    assert.match((err as Error).message, /Path params not found/);
                    return true;
                },
            );
        });

        it("throws InvalidPathParamsError for invalid path params", async () => {
            const req = HttpRequest.builder().extension(PATH_PARAMS, { userId: "-10" }).body(null);

            const extract = pathParams(schema);

            await assert.rejects(
                async () => extract(req),
                (err: unknown) => {
                    assert(err instanceof InvalidPathParamsError);
                    assert(Array.isArray(err.issues));
                    assert(err.issues.length > 0);
                    return true;
                },
            );
        });
    });

    it("InvalidPathParamsError produces 400 response", async () => {
        const issues = [
            {
                path: ["userId"],
                message: "Must be positive",
                reason: "Too small",
            },
        ];

        const err = new InvalidPathParamsError(issues);
        const res = err[TO_HTTP_RESPONSE]();

        assert.equal(res.status, StatusCode.BAD_REQUEST);
        assert.deepEqual(await consumers.text(res.body.read()), "Invalid path params");
    });
});
