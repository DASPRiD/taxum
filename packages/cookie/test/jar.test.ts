import assert from "node:assert/strict";
import { generateKeySync } from "node:crypto";
import { describe, it } from "node:test";
import {
    HeaderMap,
    HttpResponse,
    HttpResponseParts,
    TO_HTTP_RESPONSE_PARTS,
} from "@taxum/core/http";
import { Cookie, CookieJar } from "../src/index.js";

describe("jar", () => {
    describe("constructor & get()", () => {
        it("retrieves original cookies", () => {
            const jar = new CookieJar([new Cookie("foo", "bar")]);
            assert.equal(jar.get("foo")?.value, "bar");
            assert.equal(jar.get("nope"), null);
        });

        it("returns null if removed", () => {
            const jar = new CookieJar([new Cookie("gone", "yes")]);
            jar.remove(new Cookie("gone"));
            assert.equal(jar.get("gone"), null);
        });
    });

    describe("fromHeaders()", () => {
        it("parses cookies from headers", () => {
            const headers = HeaderMap.from([
                ["cookie", "a=1; b=2"],
                ["cookie", "c=3"],
            ]);
            const jar = CookieJar.fromHeaders(headers);

            assert.equal(jar.get("a")?.value, "1");
            assert.equal(jar.get("b")?.value, "2");
            assert.equal(jar.get("c")?.value, "3");
        });

        it("skips invalid cookies", () => {
            const headers = HeaderMap.from([["cookie", "valid=ok; invalidcookie"]]);
            const jar = CookieJar.fromHeaders(headers);

            assert.equal(jar.get("valid")?.value, "ok");
            assert.equal(jar.get("invalidcookie"), null);
        });
    });

    describe("signed() and private()", () => {
        it("creates SignedJar", () => {
            const jar = new CookieJar();
            assert(jar.signed(generateKeySync("hmac", { length: 512 })));
        });

        it("creates PrivateJar", () => {
            const jar = new CookieJar();
            assert(jar.private(generateKeySync("aes", { length: 256 })));
        });
    });

    describe("add()", () => {
        it("adds and replaces cookies", () => {
            const jar = new CookieJar([new Cookie("x", "1")]);
            jar.add(new Cookie("x", "2"));
            assert.equal(jar.get("x")?.value, "2");
        });
    });

    describe("remove()", () => {
        it("emits removal cookie in TO_HTTP_RESPONSE_PARTS when original existed", () => {
            const original = new Cookie("toremove", "yes");
            const jar = new CookieJar([original]);
            jar.remove(new Cookie("toremove", "yes"));

            const res = HttpResponse.builder().body(null);
            const parts = new HttpResponseParts(res);
            jar[TO_HTTP_RESPONSE_PARTS](parts);

            assert.equal(
                res.headers.get("set-cookie")?.value,
                "toremove=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
            );
        });

        it("does not emit anything if cookie was only in delta", () => {
            const jar = new CookieJar();
            const temp = new Cookie("temp", "val");
            jar.add(temp);
            jar.remove(temp);

            const res = HttpResponse.builder().body(null);
            const parts = new HttpResponseParts(res);
            jar[TO_HTTP_RESPONSE_PARTS](parts);

            assert.equal(res.headers.get("set-cookie"), null);
        });
    });

    describe("iteration", () => {
        it("yields delta first, then originals not replaced", () => {
            const jar = new CookieJar([new Cookie("a", "1"), new Cookie("b", "2")]);
            jar.add(new Cookie("b", "updated"));
            jar.add(new Cookie("c", "3"));

            const names = [...jar].map((c) => c.name);
            assert.deepEqual(new Set(names), new Set(["b", "c", "a"]));
        });
    });

    describe("[TO_HTTP_RESPONSE_PARTS]", () => {
        it("inserts set-cookie for delta cookies", () => {
            const cookie = new Cookie("sc", "val");
            cookie.toString = () => "encoded-cookie";
            const jar = new CookieJar();
            jar.add(cookie);

            const res = HttpResponse.builder().body(null);
            const parts = new HttpResponseParts(res);
            jar[TO_HTTP_RESPONSE_PARTS](parts);

            assert.equal(res.headers.get("set-cookie")?.value, "sc=val");
        });
    });
});
