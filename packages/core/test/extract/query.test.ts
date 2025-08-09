import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { z } from "zod";
import { InvalidQueryDataError, query } from "../../src/extract/index.js";
import { HttpRequest, StatusCode } from "../../src/http/index.js";

describe("extract:query", () => {
    const schema = z.object({
        page: z.coerce.number().int().nonnegative(),
        size: z.coerce.number().int().positive().optional(),
    });

    it("parses valid query parameters", async () => {
        const url = new URL("http://localhost/users?page=2&size=10");
        const req = HttpRequest.builder().uri(url).body(null);

        const extract = query(schema);
        const result = await extract(req);

        assert.deepEqual(result, { page: 2, size: 10 });
    });

    it("parses query with optional field omitted", async () => {
        const url = new URL("http://localhost/users?page=0");
        const req = HttpRequest.builder().uri(url).body(null);

        const extract = query(schema);
        const result = await extract(req);

        assert.deepEqual(result, { page: 0 });
    });

    it("throws InvalidQueryDataError for invalid query", async () => {
        const url = new URL("http://localhost/users?page=-1");
        const req = HttpRequest.builder().uri(url).body(null);

        const extract = query(schema);
        await assert.rejects(
            async () => extract(req),
            (err: unknown) => {
                assert(err instanceof InvalidQueryDataError);
                assert(Array.isArray(err.issues));
                assert(err.issues.length > 0);
                return true;
            },
        );
    });

    it("returns 400 response from InvalidQueryDataError", async () => {
        const issues = [
            {
                path: ["page"],
                message: "Invalid page",
                reason: "Too small",
            },
        ];

        const err = new InvalidQueryDataError(issues);
        const res = err.toHttpResponse();

        assert.equal(res.status, StatusCode.BAD_REQUEST);
        assert.deepEqual(await consumers.text(res.body.read()), "Invalid query params");
    });
});
