import assert from "node:assert/strict";
import { SocketAddress } from "node:net";
import { describe, it } from "node:test";
import type { TLSSocket } from "node:tls";
import util from "node:util";
import { IncomingMessage } from "node-mock-http";
import {
    Body,
    ExtensionKey,
    Extensions,
    HeaderMap,
    HeaderValue,
    HttpRequest,
    HttpRequestBuilder,
    Method,
    Parts,
} from "../../src/http/index.js";

describe("http:request", () => {
    describe("Parts", () => {
        it("constructs with given args", () => {
            const method = Method.GET;
            const uri = new URL("http://example.com/");
            const version = "1.1";
            const headers = new HeaderMap();
            const extensions = new Extensions();

            const parts = new Parts(method, uri, version, headers, extensions);
            assert.equal(parts.method, method);
            assert.equal(parts.uri.toString(), uri.toString());
            assert.equal(parts.version, version);
            assert.equal(parts.headers, headers);
            assert.equal(parts.extensions, extensions);
        });

        it("defaults extensions if not provided", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            assert(parts.extensions.isEmpty());
        });

        it("fromIncomingMessage parses request with no trustProxy", () => {
            const message = new IncomingMessage();
            message.url = "/path?query=1";
            message.headers["x-forwarded-proto"] = "https";
            message.headers["x-forwarded-host"] = "proxy.com";
            message.headers.host = "example.com";

            const parts = Parts.fromIncomingMessage(message, false);
            assert.equal(parts.method.value, "GET");
            assert.equal(parts.uri.toString(), "http://example.com/path?query=1");
            assert.equal(parts.version, "1.1");
            assert.equal(parts.headers.get("host")?.value, "example.com");
        });

        it("fromIncomingMessage respects x-forwarded headers if trustProxy is true", () => {
            const message = new IncomingMessage();
            message.method = "POST";
            message.headers["x-forwarded-proto"] = "https";
            message.headers["x-forwarded-host"] = "proxy.com";

            const parts = Parts.fromIncomingMessage(message, true);
            assert.equal(parts.uri.protocol, "https:");
            assert.equal(parts.uri.host, "proxy.com");
            assert.equal(parts.method.value, "POST");
            assert.equal(parts.version, "1.1");
        });

        it("fromIncomingMessage falls back to local protocol and host with missing proxy headers", () => {
            const message = new IncomingMessage();
            (message.socket as unknown as TLSSocket).encrypted = true;

            const parts = Parts.fromIncomingMessage(message, true);
            assert.equal(parts.uri.protocol, "https:");
            assert.equal(parts.uri.host, "localhost");
        });

        it("fromIncomingMessage falls back to host header with missing proxy headers", () => {
            const message = new IncomingMessage();
            (message.socket as unknown as TLSSocket).encrypted = true;
            message.headers.host = "real.com";

            const parts = Parts.fromIncomingMessage(message, true);
            assert.equal(parts.uri.protocol, "https:");
            assert.equal(parts.uri.host, "real.com");
        });

        it("fromIncomingMessage falls back to local protocol and host with trustProxy false", () => {
            const message = new IncomingMessage();
            (message.socket as unknown as TLSSocket).encrypted = true;

            const parts = Parts.fromIncomingMessage(message, false);
            assert.equal(parts.uri.protocol, "https:");
            assert.equal(parts.uri.host, "localhost");
        });

        it("fromIncomingMessage does not crash with missing method", () => {
            const message = new IncomingMessage();
            (message.method as string | undefined) = undefined;

            const parts = Parts.fromIncomingMessage(message, false);
            assert.equal(parts.method.value, "");
        });
    });

    describe("HttpRequest", () => {
        it("constructs with parts and body", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            const body = Body.from("test");
            const req = new HttpRequest(parts, body);

            assert.equal(req.head, parts);
            assert.equal(req.body, body);
            assert.equal(req.connectInfo.address, "0.0.0.0");
            assert.equal(req.connectInfo.port, 0);
        });

        it("constructs with connectInfo", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            const body = Body.from("test");
            const req = new HttpRequest(parts, body, SocketAddress.parse("127.0.0.1:8080"));

            assert.equal(req.head, parts);
            assert.equal(req.body, body);
            assert.equal(req.connectInfo.address, "127.0.0.1");
            assert.equal(req.connectInfo.port, 8080);
        });

        it("fromIncomingMessage creates HttpRequest", () => {
            const message = new IncomingMessage();
            message.headers.host = "example.com";

            const req = HttpRequest.fromIncomingMessage(message, false);
            assert.equal(req.method.value, "GET");
            assert.equal(req.uri.host, "example.com");
            assert.equal(req.version, "1.1");
        });

        it("accessor getters return correct properties", () => {
            const parts = new Parts(
                Method.GET,
                new URL("http://x"),
                "1.1",
                new HeaderMap(),
                new Extensions(),
            );
            const req = new HttpRequest(parts, Body.from(null));

            assert.equal(req.method, parts.method);
            assert.equal(req.uri, parts.uri);
            assert.equal(req.version, parts.version);
            assert.equal(req.headers, parts.headers);
            assert.equal(req.extensions, parts.extensions);
        });

        it("creates a through request through withBody()", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            const body = Body.from("test");
            const req = new HttpRequest(parts, body);

            const newBody = Body.from("new test");
            const newReq = req.withBody(newBody);

            assert.equal(newReq.head, parts);
            assert.equal(newReq.body, newBody);
            assert.equal(newReq.connectInfo.address, "0.0.0.0");
            assert.equal(newReq.connectInfo.port, 0);
        });

        it("toJSON returns object", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            const body = Body.from("test");
            const req = new HttpRequest(parts, body);

            assert.deepEqual(req.toJSON(), {
                method: "GET",
                uri: "http://a/",
                version: "1.1",
                headers: {},
                extensions: {},
            });
        });

        it("custom inspect returns object value", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            const body = Body.from("test");
            const req = new HttpRequest(parts, body);

            assert.equal(
                util.inspect(req, { compact: true }),
                "{ method: 'GET', uri: 'http://a/', version: '1.1', headers: {}, extensions: {} }",
            );
        });
    });

    describe("HttpRequestBuilder", () => {
        it("defaults to GET and http://localhost/", () => {
            const builder = new HttpRequestBuilder();
            const req = builder.body(null);

            assert.equal(req.method.value, "GET");
            assert.equal(req.uri.toString(), "http://localhost/");
            assert.equal(req.version, "1.1");
            assert(req.headers.isEmpty());
        });

        it("method() sets the method", () => {
            const builder = new HttpRequestBuilder();
            builder.method("POST");
            const req = builder.body(null);
            assert.equal(req.method.value, "POST");
        });

        it("method() sets the method from instance", () => {
            const builder = new HttpRequestBuilder();
            builder.method(Method.POST);
            const req = builder.body(null);
            assert.equal(req.method.value, "POST");
        });

        it("uri() sets the uri", () => {
            const builder = new HttpRequestBuilder();
            builder.uri(new URL("https://example.com/test"));
            const req = builder.body(null);
            assert.equal(req.uri.toString(), "https://example.com/test");
        });

        it("path() sets the path on the URI", () => {
            const builder = new HttpRequestBuilder();
            builder.path("/newpath");
            const req = builder.body(null);
            assert.equal(req.uri.pathname, "/newpath");
        });

        it("version() sets the version", () => {
            const builder = new HttpRequestBuilder();
            builder.version("2.0");
            const req = builder.body(null);
            assert.equal(req.version, "2.0");
        });

        it("headers() replaces the headers", () => {
            const headers = new HeaderMap();
            headers.insert("x", "y");

            const builder = new HttpRequestBuilder();
            builder.headers(headers);
            const req = builder.body(null);
            assert.equal(req.headers.get("x")?.value, "y");
        });

        it("header() appends a header value", () => {
            const builder = new HttpRequestBuilder();
            builder.header("x", "y");
            builder.header("x", "z");
            const req = builder.body(null);
            const values = req.headers.getAll("x");
            assert.deepEqual(values, [new HeaderValue("y"), new HeaderValue("z")]);
        });

        it("extensions() sets extensions", () => {
            const key = new ExtensionKey("foo");
            const ext = new Extensions();
            ext.insert(key, 123);

            const builder = new HttpRequestBuilder();
            builder.extensions(ext);
            const req = builder.body(null);
            assert.equal(req.extensions, ext);
        });

        it("extension() inserts a single extension key-value", () => {
            const builder = new HttpRequestBuilder();
            const key = new ExtensionKey("foo");
            builder.extension(key, "value");
            const req = builder.body(null);
            assert.equal(req.extensions.get(key), "value");
        });

        it("connectInfo() sets the connect info", () => {
            const builder = new HttpRequestBuilder();
            builder.connectInfo(new SocketAddress({ address: "127.0.0.1" }));
            const req = builder.body(null);
            assert.equal(req.connectInfo.address, "127.0.0.1");
        });

        it("body() sets body and returns HttpRequest", () => {
            const builder = new HttpRequestBuilder();
            const req = builder
                .method("POST")
                .uri(new URL("http://x"))
                .header("content-type", "text/plain")
                .body("hello");
            assert.equal(req.method.value, "POST");
            assert.equal(req.uri.toString(), "http://x/");
            assert.equal(req.headers.get("content-type")?.value, "text/plain");
        });
    });
});
