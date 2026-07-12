import assert from "node:assert/strict";
import { SocketAddress } from "node:net";
import { describe, it } from "node:test";
import {
    CONNECT_INFO,
    ExtensionKey,
    Extensions,
    type HttpRequest,
    HttpResponse,
} from "@taxum/core/http";
import { m, Router } from "@taxum/core/routing";
import { DISCONNECT_SIGNAL, SHUTDOWN_SIGNAL } from "@taxum/core/server";
import type { HttpService } from "@taxum/core/service";
import { testClient } from "../src/index.js";

const echoService = (capture: { request?: HttpRequest }): HttpService => ({
    invoke: (req) => {
        capture.request = req;
        return HttpResponse.builder().body("ok");
    },
});

describe("client", () => {
    it("invokes a router route", async () => {
        const router = new Router().route(
            "/greet",
            m.get(() => "hello"),
        );

        const res = await testClient(router).get("/greet");

        assert.equal(res.status, 200);
        assert.equal(await res.text(), "hello");
    });

    it("resolves paths against the base URI and injects a host header", async () => {
        const capture: { request?: HttpRequest } = {};
        const client = testClient(echoService(capture), {
            baseUri: "https://api.example.com",
        });

        await client.get("/users");

        assert.equal(capture.request?.uri.href, "https://api.example.com/users");
        assert.equal(capture.request?.headers.get("host")?.value, "api.example.com");
    });

    it("includes the base URI port in the injected host header", async () => {
        const capture: { request?: HttpRequest } = {};
        const client = testClient(echoService(capture), {
            baseUri: "http://localhost:8080",
        });

        await client.get("/");

        assert.equal(capture.request?.headers.get("host")?.value, "localhost:8080");
    });

    it("does not overwrite an explicit host header", async () => {
        const capture: { request?: HttpRequest } = {};

        await testClient(echoService(capture)).get("/").header("host", "override.example.com");

        assert.equal(capture.request?.headers.get("host")?.value, "override.example.com");
    });

    it("injects default connect info and inert signals", async () => {
        const capture: { request?: HttpRequest } = {};

        await testClient(echoService(capture)).get("/");

        const connectInfo = capture.request?.extensions.get(CONNECT_INFO);
        assert.equal(connectInfo?.address, "127.0.0.1");
        assert.equal(capture.request?.extensions.get(DISCONNECT_SIGNAL)?.aborted, false);
        assert.equal(capture.request?.extensions.get(SHUTDOWN_SIGNAL)?.aborted, false);
    });

    it("uses the configured client IP", async () => {
        const capture: { request?: HttpRequest } = {};
        const client = testClient(echoService(capture), { clientIp: "203.0.113.7" });

        await client.get("/");

        assert.equal(capture.request?.extensions.get(CONNECT_INFO)?.address, "203.0.113.7");
    });

    it("lets a per-request client IP override the configured one", async () => {
        const capture: { request?: HttpRequest } = {};
        const client = testClient(echoService(capture), { clientIp: "203.0.113.7" });

        await client.get("/").clientIp("2001:db8::1");

        const connectInfo = capture.request?.extensions.get(CONNECT_INFO);
        assert.equal(connectInfo?.address, "2001:db8::1");
        assert.equal(connectInfo?.family, "ipv6");
    });

    it("accepts a SocketAddress as client IP", async () => {
        const capture: { request?: HttpRequest } = {};
        const address = new SocketAddress({ address: "10.0.0.1", family: "ipv4", port: 4711 });

        await testClient(echoService(capture), { clientIp: address }).get("/");

        assert.equal(capture.request?.extensions.get(CONNECT_INFO), address);
    });

    it("applies client-level extensions to every request without sharing state", async () => {
        const key = new ExtensionKey<string>("test");
        const marker = new ExtensionKey<string>("marker");
        const requests: HttpRequest[] = [];
        const service: HttpService = {
            invoke: (req) => {
                if (requests.length === 0) {
                    req.extensions.insert(marker, "polluted");
                }

                requests.push(req);
                return HttpResponse.builder().body(null);
            },
        };
        const clientExtensions = new Extensions();
        clientExtensions.insert(key, "value");
        const client = testClient(service, { extensions: clientExtensions });

        await client.get("/");
        await client.get("/");

        assert.equal(requests[0].extensions.get(key), "value");
        assert.equal(requests[1].extensions.get(key), "value");
        assert.equal(requests[1].extensions.get(marker), undefined);
    });

    it("lets per-request extensions override client-level extensions", async () => {
        const key = new ExtensionKey<string>("test");
        const capture: { request?: HttpRequest } = {};
        const clientExtensions = new Extensions();
        clientExtensions.insert(key, "client");
        const client = testClient(echoService(capture), { extensions: clientExtensions });

        await client.get("/").extension(key, "request");

        assert.equal(capture.request?.extensions.get(key), "request");
    });

    it("passes a user-supplied disconnect signal through", async () => {
        const capture: { request?: HttpRequest } = {};
        const controller = new AbortController();

        await testClient(echoService(capture)).get("/").disconnectSignal(controller.signal);

        assert.equal(capture.request?.extensions.get(DISCONNECT_SIGNAL), controller.signal);
        controller.abort();
        assert.equal(capture.request?.extensions.get(DISCONNECT_SIGNAL)?.aborted, true);
    });

    it("sends each verb with the matching method", async () => {
        const capture: { request?: HttpRequest } = {};
        const client = testClient(echoService(capture));
        const verbs = [
            ["get", "GET"],
            ["post", "POST"],
            ["put", "PUT"],
            ["patch", "PATCH"],
            ["delete", "DELETE"],
            ["head", "HEAD"],
            ["options", "OPTIONS"],
        ] as const;

        for (const [verb, method] of verbs) {
            await client[verb]("/");
            assert.equal(capture.request?.method.value, method);
        }
    });

    it("propagates service rejections untouched", async () => {
        const failure = new Error("boom");
        const service: HttpService = {
            invoke: () => {
                throw failure;
            },
        };

        await assert.rejects(testClient(service).get("/"), failure);
    });
});
