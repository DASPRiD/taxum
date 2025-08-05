import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import type { TLSSocket } from "node:tls";
import { IncomingMessage } from "node-mock-http";
import {
    ExtensionKey,
    Extensions,
    HeaderMap,
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
            assert.equal(parts.method.toValue(), "GET");
            assert.equal(parts.uri.toString(), "http://example.com/path?query=1");
            assert.equal(parts.version, "1.1");
            assert.equal(parts.headers.get("host"), "example.com");
        });

        it("fromIncomingMessage respects x-forwarded headers if trustProxy is true", () => {
            const message = new IncomingMessage();
            message.method = "POST";
            message.headers["x-forwarded-proto"] = "https";
            message.headers["x-forwarded-host"] = "proxy.com";

            const parts = Parts.fromIncomingMessage(message, true);
            assert.equal(parts.uri.protocol, "https:");
            assert.equal(parts.uri.host, "proxy.com");
            assert.equal(parts.method.toValue(), "POST");
            assert.equal(parts.version, "1.1");
        });

        it("fromIncomingMessage falls back to local protocol and host with missing proxy headers", () => {
            const message = new IncomingMessage();
            (message.socket as unknown as TLSSocket).encrypted = true;

            const parts = Parts.fromIncomingMessage(message, true);
            assert.equal(parts.uri.protocol, "https:");
            assert.equal(parts.uri.host, "localhost");
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
            assert.equal(parts.method.toValue(), "");
        });
    });

    describe("HttpRequest", () => {
        it("constructs with parts and body", () => {
            const parts = new Parts(Method.GET, new URL("http://a"), "1.1", new HeaderMap());
            const body = Readable.from(["test"]);
            const req = new HttpRequest(parts, body);

            assert.equal(req.head, parts);
            assert.equal(req.body, body);
        });

        it("fromIncomingMessage creates HttpRequest", () => {
            const message = new IncomingMessage();
            message.headers.host = "example.com";

            const req = HttpRequest.fromIncomingMessage(message, false);
            assert.equal(req.method.toValue(), "GET");
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
            const req = new HttpRequest(parts, Readable.from([]));

            assert.equal(req.method, parts.method);
            assert.equal(req.uri, parts.uri);
            assert.equal(req.version, parts.version);
            assert.equal(req.headers, parts.headers);
            assert.equal(req.extensions, parts.extensions);
        });
    });

    describe("HttpRequestBuilder", () => {
        it("defaults to GET and http://localhost/", () => {
            const builder = new HttpRequestBuilder();
            const req = builder.body(null);

            assert.equal(req.method.toValue(), "GET");
            assert.equal(req.uri.toString(), "http://localhost/");
            assert.equal(req.version, "1.1");
            assert(req.headers.isEmpty());
        });

        it("method() sets the method", () => {
            const builder = new HttpRequestBuilder();
            builder.method("POST");
            const req = builder.body(null);
            assert.equal(req.method.toValue(), "POST");
        });

        it("method() sets the method from instance", () => {
            const builder = new HttpRequestBuilder();
            builder.method(Method.POST);
            const req = builder.body(null);
            assert.equal(req.method.toValue(), "POST");
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
            assert.equal(req.headers.get("x"), "y");
        });

        it("header() appends a header value", () => {
            const builder = new HttpRequestBuilder();
            builder.header("x", "y");
            builder.header("x", "z");
            const req = builder.body(null);
            const values = req.headers.getAll("x");
            assert.deepEqual(values, ["y", "z"]);
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

        it("body() sets body and returns HttpRequest", () => {
            const builder = new HttpRequestBuilder();
            const req = builder
                .method("POST")
                .uri(new URL("http://x"))
                .header("content-type", "text/plain")
                .body("hello");
            assert.equal(req.method.toValue(), "POST");
            assert.equal(req.uri.toString(), "http://x/");
            assert.equal(req.headers.get("content-type"), "text/plain");
        });
    });
});
