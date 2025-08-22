import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import { StatusCode, TO_HTTP_RESPONSE } from "../../src/http/index.js";
import { ClientError } from "../../src/util/index.js";

describe("util:client-error", () => {
    it("has status and message properties", () => {
        const error = new ClientError(StatusCode.BAD_REQUEST, "invalid input");
        assert.equal(error.status, StatusCode.BAD_REQUEST);
        assert.equal(error.message, "invalid input");
        assert.equal(error.name, StatusCode.BAD_REQUEST.phrase);
    });

    it("converts to HttpResponse via TO_HTTP_RESPONSE", async () => {
        const error = new ClientError(StatusCode.NOT_FOUND, "not found");
        const res = error[TO_HTTP_RESPONSE]();
        assert.equal(res.status, StatusCode.NOT_FOUND);

        const text = await consumers.text(res.body.readable);
        assert.equal(text, "not found");
    });
});
