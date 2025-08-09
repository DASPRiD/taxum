import assert from "node:assert/strict";
import { SocketAddress } from "node:net";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { CLIENT_IP, SetClientIpLayer } from "../../src/layer/client-ip.js";

describe("layer/client-ip", () => {
    const dummyResponse = HttpResponse.builder().body(null);

    it("inserts connectInfo.address as client IP when trustProxy is false", async () => {
        const connectInfo = new SocketAddress({ address: "192.168.1.100" });
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.strictEqual(req.extensions.get(CLIENT_IP), connectInfo.address);
                return dummyResponse;
            },
        };

        const layer = new SetClientIpLayer(false);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().connectInfo(connectInfo).body(null);

        await service.invoke(req);
    });

    it("inserts first valid IP from x-forwarded-for when trustProxy is true", async () => {
        const connectInfo = new SocketAddress({ address: "192.168.1.100" });
        const forwardedFor = "203.0.113.1, 198.51.100.101";
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.strictEqual(req.extensions.get(CLIENT_IP), "203.0.113.1");
                return dummyResponse;
            },
        };

        const layer = new SetClientIpLayer(true);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder()
            .connectInfo(connectInfo)
            .header("x-forwarded-for", forwardedFor)
            .body(null);

        await service.invoke(req);
    });

    it("falls back to connectInfo.address if x-forwarded-for header is missing and trustProxy is true", async () => {
        const connectInfo = new SocketAddress({ address: "192.168.1.100" });
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.strictEqual(req.extensions.get(CLIENT_IP), connectInfo.address);
                return dummyResponse;
            },
        };

        const layer = new SetClientIpLayer(true);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().connectInfo(connectInfo).body(null);

        await service.invoke(req);
    });

    it("filters out invalid IPs in x-forwarded-for and uses first valid one", async () => {
        const connectInfo = new SocketAddress({ address: "192.168.1.100" });
        const forwardedFor = "invalid, 203.0.113.1, 198.51.100.101";
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.strictEqual(req.extensions.get(CLIENT_IP), "203.0.113.1");
                return dummyResponse;
            },
        };

        const layer = new SetClientIpLayer(true);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder()
            .connectInfo(connectInfo)
            .header("x-forwarded-for", forwardedFor)
            .body(null);

        await service.invoke(req);
    });

    it("falls back to connectInfo.address if no valid IPs in x-forwarded-for", async () => {
        const connectInfo = new SocketAddress({ address: "192.168.1.100" });
        const forwardedFor = "invalid, also-invalid";
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.strictEqual(req.extensions.get(CLIENT_IP), connectInfo.address);
                return dummyResponse;
            },
        };

        const layer = new SetClientIpLayer(true);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder()
            .connectInfo(connectInfo)
            .header("x-forwarded-for", forwardedFor)
            .body(null);

        await service.invoke(req);
    });
});
