import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type HttpRequest, HttpResponse } from "@taxum/core/http";
import { m, Router } from "@taxum/core/routing";
import type { HttpService } from "@taxum/core/service";
import { TestCookieJar, testClient } from "../src/index.js";

const uri = (path: string, protocol = "http"): URL => new URL(`${protocol}://localhost${path}`);

describe("jar", () => {
    describe("TestCookieJar", () => {
        it("stores and retrieves seeded cookies", () => {
            const jar = new TestCookieJar();
            jar.set("session", "abc");

            assert.equal(jar.get("session")?.value, "abc");
            assert.equal(jar.get("session")?.path, "/");
            assert.equal(jar.get("missing"), null);
        });

        it("seeds cookies with attributes via the object form", () => {
            const jar = new TestCookieJar();
            jar.set({ name: "scoped", value: "1", path: "/admin", secure: true });

            assert.equal(jar.get("scoped")?.path, "/admin");
            assert.equal(jar.get("scoped")?.secure, true);
        });

        it("deletes cookies by name across paths and clears entirely", () => {
            const jar = new TestCookieJar();
            jar.set({ name: "a", value: "1", path: "/x" });
            jar.set({ name: "a", value: "2", path: "/y" });
            jar.set("b", "3");

            jar.delete("a");
            assert.equal(jar.get("a"), null);
            assert.equal(jar.get("b")?.value, "3");

            jar.clear();
            assert.deepEqual([...jar], []);
        });

        it("keys cookies by name and path", () => {
            const jar = new TestCookieJar();
            jar.ingest("pref=old; Path=/a", uri("/"));
            jar.ingest("pref=new; Path=/a", uri("/"));
            jar.ingest("pref=other; Path=/b", uri("/"));

            assert.equal([...jar].length, 2);
            assert.equal(jar.cookiesFor(uri("/a"))[0]?.value, "new");
        });

        it("parses attributes from set-cookie headers", () => {
            const jar = new TestCookieJar();
            jar.ingest(
                "sid=abc; Path=/app; Max-Age=3600; Secure; HttpOnly; SameSite=Lax",
                uri("/"),
            );

            const cookie = jar.get("sid");
            assert.equal(cookie?.value, "abc");
            assert.equal(cookie?.path, "/app");
            assert.equal(cookie?.maxAge, 3600);
            assert.equal(cookie?.secure, true);
            assert.equal(cookie?.httpOnly, true);
            assert.equal(cookie?.sameSite, "Lax");
        });

        it("keeps values verbatim without percent-decoding", () => {
            const jar = new TestCookieJar();
            jar.ingest("enc=a%20b%3D; Path=/", uri("/"));

            assert.equal(jar.get("enc")?.value, "a%20b%3D");
        });

        it("derives the default path from the request URI", () => {
            const jar = new TestCookieJar();
            jar.ingest("a=1", uri("/admin/settings"));
            jar.ingest("b=2", uri("/top"));

            assert.equal(jar.get("a")?.path, "/admin");
            assert.equal(jar.get("b")?.path, "/");
        });

        it("treats empty or relative Path attributes as absent", () => {
            const jar = new TestCookieJar();
            jar.ingest("a=1; Path=", uri("/deep/page"));
            jar.ingest("b=2; Path=foo", uri("/deep/page"));

            assert.equal(jar.get("a")?.path, "/deep");
            assert.equal(jar.get("b")?.path, "/deep");
        });

        it("defaults secure and httpOnly to false", () => {
            const jar = new TestCookieJar();
            jar.ingest("plain=1", uri("/"));
            jar.set("seeded", "2");

            assert.equal(jar.get("plain")?.secure, false);
            assert.equal(jar.get("plain")?.httpOnly, false);
            assert.equal(jar.get("seeded")?.secure, false);
        });

        it("treats a malformed Expires as a session cookie", () => {
            const jar = new TestCookieJar();
            jar.ingest("odd=1; Expires=garbage", uri("/"));

            assert.equal(jar.get("odd")?.value, "1");
            assert.equal(jar.cookiesFor(uri("/")).length, 1);
        });

        it("removes cookies via a negative Max-Age", () => {
            const jar = new TestCookieJar();
            jar.ingest("sid=abc; Path=/", uri("/"));
            jar.ingest("sid=; Path=/; Max-Age=-1", uri("/"));

            assert.equal(jar.get("sid"), null);
        });

        it("returns the longest-path cookie from get() when names collide", () => {
            const jar = new TestCookieJar();
            jar.ingest("s=outer; Path=/", uri("/"));
            jar.ingest("s=inner; Path=/a/b", uri("/"));

            assert.equal(jar.get("s")?.value, "inner");
        });

        it("removes cookies via Max-Age=0", () => {
            const jar = new TestCookieJar();
            jar.ingest("sid=abc; Path=/", uri("/"));
            jar.ingest("sid=; Path=/; Max-Age=0", uri("/"));

            assert.equal(jar.get("sid"), null);
        });

        it("drops cookies whose expiry has passed", () => {
            const jar = new TestCookieJar();
            jar.ingest("old=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT", uri("/"));
            jar.ingest("fresh=1; Max-Age=3600", uri("/"));

            assert.equal(jar.get("old"), null);
            assert.equal(jar.get("fresh")?.value, "1");
        });

        it("prefers max-age over expires", () => {
            const jar = new TestCookieJar();
            jar.ingest("mixed=1; Max-Age=3600; Expires=Wed, 21 Oct 2015 07:28:00 GMT", uri("/"));

            assert.equal(jar.get("mixed")?.value, "1");
        });

        it("matches cookie paths per RFC 6265", () => {
            const jar = new TestCookieJar();
            jar.ingest("scoped=1; Path=/admin", uri("/"));

            assert.equal(jar.cookiesFor(uri("/admin")).length, 1);
            assert.equal(jar.cookiesFor(uri("/admin/users")).length, 1);
            assert.equal(jar.cookiesFor(uri("/administrator")).length, 0);
            assert.equal(jar.cookiesFor(uri("/public")).length, 0);
        });

        it("withholds secure cookies from http URIs", () => {
            const jar = new TestCookieJar();
            jar.ingest("sid=abc; Path=/; Secure", uri("/"));

            assert.equal(jar.cookiesFor(uri("/", "http")).length, 0);
            assert.equal(jar.cookiesFor(uri("/", "https")).length, 1);
        });

        it("sends domain and httpOnly cookies regardless", () => {
            const jar = new TestCookieJar();
            jar.ingest("a=1; Domain=other.example; HttpOnly", uri("/"));

            assert.equal(jar.cookiesFor(uri("/")).length, 1);
        });

        it("orders matches by longest path first", () => {
            const jar = new TestCookieJar();
            jar.ingest("outer=1; Path=/", uri("/"));
            jar.ingest("inner=2; Path=/admin", uri("/"));

            assert.deepEqual(
                jar.cookiesFor(uri("/admin/x")).map((cookie) => cookie.name),
                ["inner", "outer"],
            );
        });
    });

    describe("client integration", () => {
        it("captures cookies and sends them on subsequent requests", async () => {
            let seenCookie: string | null = null;
            const router = new Router()
                .route(
                    "/login",
                    m.post(() =>
                        HttpResponse.builder()
                            .header("set-cookie", "session=abc; Path=/")
                            .body("ok"),
                    ),
                )
                .route(
                    "/me",
                    m.get((req: HttpRequest) => {
                        seenCookie = req.headers.get("cookie")?.value ?? null;
                        return "me";
                    }),
                );
            const client = testClient(router, { saveCookies: true });

            await client.post("/login").body(null);
            await client.get("/me");

            assert.equal(seenCookie, "session=abc");
            assert.equal(client.cookies.get("session")?.value, "abc");
        });

        it("does not capture cookies when saveCookies is off", async () => {
            const service: HttpService = {
                invoke: () =>
                    HttpResponse.builder().header("set-cookie", "sid=1; Path=/").body(null),
            };
            const client = testClient(service);

            await client.get("/");

            assert.equal(client.cookies.get("sid"), null);
        });

        it("sends seeded cookies even when saveCookies is off", async () => {
            const capture: { request?: HttpRequest } = {};
            const service: HttpService = {
                invoke: (req) => {
                    capture.request = req;
                    return HttpResponse.builder().body(null);
                },
            };
            const client = testClient(service);
            client.cookies.set("session", "seeded");

            await client.get("/");

            assert.equal(capture.request?.headers.get("cookie")?.value, "session=seeded");
        });

        it("merges jar cookies with per-request cookies", async () => {
            const capture: { request?: HttpRequest } = {};
            const service: HttpService = {
                invoke: (req) => {
                    capture.request = req;
                    return HttpResponse.builder().body(null);
                },
            };
            const client = testClient(service);
            client.cookies.set("jarred", "1");

            await client.get("/").cookie("adhoc", "2");

            assert.equal(capture.request?.headers.get("cookie")?.value, "jarred=1; adhoc=2");
        });

        it("captures multiple set-cookie headers from one response", async () => {
            const service: HttpService = {
                invoke: () =>
                    HttpResponse.builder()
                        .header("set-cookie", "a=1; Path=/")
                        .header("set-cookie", "b=2; Path=/")
                        .body(null),
            };
            const client = testClient(service, { saveCookies: true });

            await client.get("/");

            assert.equal(client.cookies.get("a")?.value, "1");
            assert.equal(client.cookies.get("b")?.value, "2");
        });

        it("respects path scoping end to end", async () => {
            const cookies: (string | null)[] = [];
            const service: HttpService = {
                invoke: (req) => {
                    cookies.push(req.headers.get("cookie")?.value ?? null);

                    if (req.uri.pathname === "/admin/login") {
                        return HttpResponse.builder()
                            .header("set-cookie", "admin=1; Path=/admin")
                            .body(null);
                    }

                    return HttpResponse.builder().body(null);
                },
            };
            const client = testClient(service, { saveCookies: true });

            await client.get("/admin/login");
            await client.get("/admin/panel");
            await client.get("/public");

            assert.deepEqual(cookies, [null, "admin=1", null]);
        });
    });
});
