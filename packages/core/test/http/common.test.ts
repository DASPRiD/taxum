import assert from "node:assert/strict";
import consumers from "node:stream/consumers";
import { describe, it } from "node:test";
import {
    htmlResponse,
    jsonResponse,
    noContentResponse,
    Redirect,
    StatusCode,
    TO_HTTP_RESPONSE,
} from "../../src/http/index.js";

describe("http:common", () => {
    describe("noContentResponse", () => {
        it("returns a 204 no content response", async () => {
            const res = noContentResponse[TO_HTTP_RESPONSE]();
            assert.equal(res.status.code, 204);

            const body = await consumers.text(res.body.readable);
            assert.equal(body, "");
        });
    });

    describe("jsonResponse", () => {
        it("returns a JSON response with content-type header", async () => {
            const res = jsonResponse({ ok: true })[TO_HTTP_RESPONSE]();
            assert.equal(res.status.code, 200);
            assert.equal(res.headers.get("content-type")?.value, "application/json");

            const body = await consumers.text(res.body.readable);
            assert.equal(body, JSON.stringify({ ok: true }));
        });
    });

    describe("jsonResponse", () => {
        it("returns an HTML response with content-type header", async () => {
            const html = "<h1>Hello</h1>";
            const res = htmlResponse(html)[TO_HTTP_RESPONSE]();
            assert.equal(res.status.code, 200);
            assert.equal(res.headers.get("content-type")?.value, "text/html");

            const body = await consumers.text(res.body.readable);
            assert.equal(body, JSON.stringify(html));
        });
    });

    describe("Redirect", () => {
        const testCases = [
            {
                label: "Redirect.to (303)",
                redirect: Redirect.to("/see-other"),
                expectedStatus: StatusCode.SEE_OTHER,
                expectedLocation: "/see-other",
            },
            {
                label: "Redirect.temporary (307)",
                redirect: Redirect.temporary("/temporary"),
                expectedStatus: StatusCode.TEMPORARY_REDIRECT,
                expectedLocation: "/temporary",
            },
            {
                label: "Redirect.permanent (308)",
                redirect: Redirect.permanent("/permanent"),
                expectedStatus: StatusCode.PERMANENT_REDIRECT,
                expectedLocation: "/permanent",
            },
        ];

        for (const { label, redirect, expectedStatus, expectedLocation } of testCases) {
            it(`returns correct response for ${label}`, async () => {
                const res = redirect[TO_HTTP_RESPONSE]();
                assert.equal(res.status.code, expectedStatus.code);
                assert.equal(res.headers.get("location")?.value, expectedLocation);

                const body = await consumers.text(res.body.readable);
                assert.equal(body, "");
            });
        }

        it("handles URL object as redirect target", async () => {
            const url = new URL("https://example.com/foo");
            const res = Redirect.to(url)[TO_HTTP_RESPONSE]();
            assert.equal(res.status.code, 303);
            assert.equal(res.headers.get("location")?.value, url.toString());
        });
    });
});
