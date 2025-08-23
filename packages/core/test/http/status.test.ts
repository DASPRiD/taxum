import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import util from "node:util";
import { StatusCode, TO_HTTP_RESPONSE } from "../../src/http/index.js";

describe("http:status", () => {
    describe("StatusCode", () => {
        it("has correct static constants", () => {
            assert.equal(StatusCode.OK.code, 200);
            assert.equal(StatusCode.OK.phrase, "OK");

            assert.equal(StatusCode.NOT_FOUND.code, 404);
            assert.equal(StatusCode.NOT_FOUND.phrase, "Not Found");

            assert.equal(StatusCode.IM_A_TEAPOT.code, 418);
            assert.equal(StatusCode.IM_A_TEAPOT.phrase, "I'm a teapot");
        });

        it("fromCode returns correct instance", () => {
            assert.equal(StatusCode.fromCode(200), StatusCode.OK);
            assert.equal(StatusCode.fromCode(404), StatusCode.NOT_FOUND);
        });

        it("fromCode throws for unknown codes", () => {
            assert.throws(() => StatusCode.fromCode(999), {
                message: "Status code 999 is not defined",
            });
        });

        it("categorizes codes correctly", () => {
            assert.equal(StatusCode.CONTINUE.isInformational(), true);
            assert.equal(StatusCode.OK.isSuccess(), true);
            assert.equal(StatusCode.MOVED_PERMANENTLY.isRedirection(), true);
            assert.equal(StatusCode.BAD_REQUEST.isClientError(), true);
            assert.equal(StatusCode.INTERNAL_SERVER_ERROR.isServerError(), true);
        });

        it("toHttpResponse returns HttpResponse with status and no body", async () => {
            const res = StatusCode.OK[TO_HTTP_RESPONSE]();
            assert.equal(res.status, StatusCode.OK);
            assert.equal(await consumers.text(res.body.readable), "");
        });

        it("toJSON returns numeric value", () => {
            assert.equal(StatusCode.OK.toJSON(), 200);
        });

        it("custom inspect returns numeric value", () => {
            assert.equal(util.inspect(StatusCode.OK), "200");
        });
    });
});
