import assert from "node:assert";
import { Readable, Transform } from "node:stream";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { z } from "zod";
import {
    InvalidJsonError,
    json,
    MalformedJsonError,
    MissingJsonContentTypeError,
} from "../../src/extract/index.js";
import { HttpRequest, StatusCode } from "../../src/http/index.js";

describe("extract:json", () => {
    const schema = z.object({ foo: z.string() });

    it("parses valid JSON body with correct content-type", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/json")
            .body('{ "foo": "bar" }');

        const extract = json(schema);
        const result = await extract(req);

        assert.deepEqual(result, { foo: "bar" });
    });

    it("rethrows stream read errors", async () => {
        const failedTransform = new Transform({
            transform(_chunk, _encoding, callback) {
                callback(new Error("Failed to transform"));
            },
        });
        const body = Readable.from([""]);
        body.pipe(failedTransform);

        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/json")
            .body(failedTransform);

        const extract = json(schema);
        await assert.rejects(async () => extract(req), new Error("Failed to transform"));
    });

    it("throws MissingJsonContentTypeError if content-type is not JSON", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "text/plain")
            .body('{ "foo": "bar" }');

        const extract = json(schema);
        await assert.rejects(async () => extract(req), MissingJsonContentTypeError);
    });

    it("throws MissingJsonContentTypeError if content-type is missing", async () => {
        const req = HttpRequest.builder().method("POST").body('{ "foo": "bar" }');

        const extract = json(schema);
        await assert.rejects(async () => extract(req), MissingJsonContentTypeError);
    });

    it("throws MalformedJsonError for invalid JSON syntax", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/json")
            .body("{ foo: bar }");

        const extract = json(schema);
        await assert.rejects(
            async () => {
                await extract(req);
            },
            (err: unknown) => {
                assert(err instanceof MalformedJsonError);
                return true;
            },
        );
    });

    it("throws InvalidJsonError for schema validation failure", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/json")
            .body('{ "foo": 123 }');

        const extract = json(schema);
        await assert.rejects(async () => extract(req), InvalidJsonError);
    });

    it("accepts JSON content-type with +json subtype", async () => {
        const req = HttpRequest.builder()
            .method("POST")
            .header("Content-Type", "application/vnd.api+json")
            .body('{ "foo": "value" }');

        const extract = json(schema);
        const result = await extract(req);

        assert.deepEqual(result, { foo: "value" });
    });

    it("MissingJsonContentTypeError produces 415 response", async () => {
        const err = new MissingJsonContentTypeError();
        const res = err.toHttpResponse();

        assert.equal(res.status, StatusCode.UNSUPPORTED_MEDIA_TYPE);
        assert.equal(
            await consumers.text(res.body.read()),
            "Expected request with `Content-Type: application/json`",
        );
    });

    it("MalformedJsonError produces 400 response", async () => {
        const err = new MalformedJsonError("Unexpected end of JSON input");
        const res = err.toHttpResponse();

        assert.equal(res.status, StatusCode.BAD_REQUEST);
        assert.equal(await consumers.text(res.body.read()), "Unexpected end of JSON input");
    });

    it("InvalidJsonError produces 422 response", async () => {
        const issues = [
            {
                path: ["name"],
                message: "Required",
                reason: "Missing",
            },
        ];

        const err = new InvalidJsonError(issues);
        const res = err.toHttpResponse();

        assert.equal(res.status, StatusCode.UNPROCESSABLE_CONTENT);
        assert.deepEqual(await consumers.json(res.body.read()), issues);
    });
});
