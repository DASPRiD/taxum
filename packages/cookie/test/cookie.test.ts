import "temporal-polyfill/global";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Cookie } from "../src/index.js";

import ZonedDateTime = Temporal.ZonedDateTime;

describe("cookie", () => {
    describe("constructor", () => {
        it("sets properties from arguments", () => {
            const date = new Date();
            const cookie = new Cookie("name", "value", {
                expires: date,
                maxAge: 123,
                domain: "example.com",
                path: "/test",
                secure: true,
                httpOnly: true,
                sameSite: "Strict",
                partitioned: true,
            });

            assert.equal(cookie.name, "name");
            assert.equal(cookie.value, "value");
            assert.equal(cookie.expires, date);
            assert.equal(cookie.maxAge, 123);
            assert.equal(cookie.domain, "example.com");
            assert.equal(cookie.path, "/test");
            assert.equal(cookie.secure, true);
            assert.equal(cookie.httpOnly, true);
            assert.equal(cookie.sameSite, "Strict");
            assert.equal(cookie.partitioned, true);
        });

        it("defaults value to empty string if not provided", () => {
            const cookie = new Cookie("empty");
            assert.equal(cookie.value, "");
        });
    });

    describe("parse()", () => {
        it("parses a valid cookie string", () => {
            const parsed = Cookie.parse("myName=myValue");
            assert(parsed instanceof Cookie);
            assert.equal(parsed?.name, "myName");
            assert.equal(parsed?.value, "myValue");
        });

        it("decodes URL-encoded names and values", () => {
            const parsed = Cookie.parse("foo%20bar=baz%2Fqux");
            assert(parsed);
            assert.equal(parsed.name, "foo bar");
            assert.equal(parsed.value, "baz/qux");
        });

        it("returns null if missing '='", () => {
            assert.equal(Cookie.parse("noequals"), null);
        });

        it("returns null if name is empty", () => {
            assert.equal(Cookie.parse("=value"), null);
        });
    });

    describe("asRemoval()", () => {
        it("returns a cookie with empty value, expires in past, and maxAge=0", () => {
            const original = new Cookie("test", "val", {
                domain: "example.com",
                path: "/",
                secure: true,
                httpOnly: true,
                sameSite: "Lax",
                partitioned: true,
            });
            const removal = original.asRemoval();

            assert.equal(removal.name, "test");
            assert.equal(removal.value, "");
            assert(removal.expires instanceof Date);
            assert.equal(removal.expires.getTime(), 0);
            assert.equal(removal.maxAge, 0);
            assert.equal(removal.domain, "example.com");
            assert.equal(removal.path, "/");
            assert.equal(removal.secure, true);
            assert.equal(removal.httpOnly, true);
            assert.equal(removal.sameSite, "Lax");
            assert.equal(removal.partitioned, true);
        });
    });

    describe("withValue()", () => {
        it("returns a new cookie with the new value but same options", () => {
            const original = new Cookie("name", "old", {
                expires: new Date(1000),
                maxAge: 42,
                domain: "example.com",
                path: "/foo",
                secure: true,
                httpOnly: false,
            });
            const updated = original.withValue("new");

            assert.equal(updated.name, "name");
            assert.equal(updated.value, "new");
            assert.equal(updated.expires, original.expires);
            assert.equal(updated.maxAge, original.maxAge);
            assert.equal(updated.domain, original.domain);
            assert.equal(updated.path, original.path);
            assert.equal(updated.secure, original.secure);
            assert.equal(updated.httpOnly, original.httpOnly);
        });
    });

    describe("encode()", () => {
        it("encodes name and value", () => {
            const cookie = new Cookie("na me", "va;lue");
            assert.match(cookie.encode(), /^na%20me=va%3Blue$/);
        });

        it("includes HttpOnly when set", () => {
            const cookie = new Cookie("a", "b", { httpOnly: true });
            assert(cookie.encode().includes("HttpOnly"));
        });

        it("includes SameSite and Secure rules", () => {
            const cookie = new Cookie("a", "b", { sameSite: "Strict", secure: true });
            const encoded = cookie.encode();
            assert(encoded.includes("SameSite=Strict"));
            assert(encoded.includes("Secure"));
        });

        it("adds Secure automatically if sameSite=None and secure undefined", () => {
            const cookie = new Cookie("a", "b", { sameSite: "None" });
            assert(cookie.encode().includes("Secure"));
        });

        it("includes Partitioned and Secure if partitioned=true", () => {
            const cookie = new Cookie("a", "b", { partitioned: true });
            const encoded = cookie.encode();
            assert(encoded.includes("Partitioned"));
            assert(encoded.includes("Secure"));
        });

        it("includes Path and Domain if provided", () => {
            const cookie = new Cookie("a", "b", { path: "/abc", domain: "example.com" });
            const encoded = cookie.encode();
            assert(encoded.includes("Path=/abc"));
            assert(encoded.includes("Domain=example.com"));
        });

        it("handles maxAge as number", () => {
            const cookie = new Cookie("a", "b", { maxAge: 123.9 });
            assert(cookie.encode().includes("Max-Age=123"));
        });

        it("handles maxAge as Temporal.Duration", () => {
            const duration = Temporal.Duration.from({ days: 1 });
            const cookie = new Cookie("a", "b", { maxAge: duration });
            assert(cookie.encode().includes("Max-Age=86400"));
        });

        it("handles expires as Date", () => {
            const date = new Date("2020-01-01T00:00:00Z");
            const cookie = new Cookie("a", "b", { expires: date });
            assert(cookie.encode().includes(`Expires=${date.toUTCString()}`));
        });

        it("handles expires as Temporal.ZonedDateTime", () => {
            const dateTime = ZonedDateTime.from("2020-01-01T00:00:00Z[UTC]");
            const cookie = new Cookie("a", "b", { expires: dateTime });
            assert(
                cookie.encode().includes(`Expires=${new Date(Date.UTC(2020, 0, 1)).toUTCString()}`),
            );
        });
    });
});
