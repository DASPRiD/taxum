import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { z } from "zod";
import {
    form,
    InvalidFormDataError,
    MissingFormDataContentTypeError,
} from "../../src/extract/index.js";
import { HttpRequest, StatusCode } from "../../src/http/index.js";

describe("extract:form", () => {
    const schema = z.object({
        foo: z.string(),
        bar: z.coerce.number().int().positive(),
    });

    it("parses valid form body (POST)", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("foo=hello&bar=42");

        const result = await form(schema)(req);
        assert.deepEqual(result, { foo: "hello", bar: 42 });
    });

    it("parses valid form from GET query", async () => {
        const req = HttpRequest.builder()
            .method("GET")
            .uri(new URL("http://localhost/?foo=hi&bar=123"))
            .body(null);

        const result = await form(schema)(req);
        assert.deepEqual(result, { foo: "hi", bar: 123 });
    });

    it("throws on missing content-type for POST", async () => {
        const req = HttpRequest.builder().method("POST").body("foo=hello&bar=42");

        await assert.rejects(async () => form(schema)(req), MissingFormDataContentTypeError);
    });

    it("throws on invalid form data", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("foo=&bar=not-a-number");

        await assert.rejects(async () => form(schema)(req), InvalidFormDataError);
    });

    it("MissingFormDataContentTypeError produces 415 response", async () => {
        const err = new MissingFormDataContentTypeError();
        const res = err.toHttpResponse();

        assert.equal(res.status, StatusCode.UNSUPPORTED_MEDIA_TYPE);
        assert.equal(
            await consumers.text(res.body.read()),
            "Expected request with `Content-Type: application/x-www-form-urlencoded`",
        );
    });

    it("InvalidFormDataError produces 422 response", async () => {
        const issues = [
            {
                path: ["bar"],
                message: "Expected number, received string",
                reason: "Invalid type",
            },
        ];

        const err = new InvalidFormDataError(issues);
        const res = err.toHttpResponse();

        assert.equal(res.status, StatusCode.UNPROCESSABLE_CONTENT);
        assert.deepEqual(await consumers.json(res.body.read()), issues);
    });
});
