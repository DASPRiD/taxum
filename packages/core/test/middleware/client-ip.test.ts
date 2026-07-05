import assert from "node:assert/strict";
import { SocketAddress } from "node:net";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { CLIENT_IP, SetClientIpLayer } from "../../src/middleware/client-ip.js";

describe("middleware/client-ip", () => {
    const dummyResponse = HttpResponse.builder().body(null);

    const clientIpFor = async (
        trustProxy: boolean | number,
        socketAddress: string,
        forwardedFor?: string,
    ): Promise<string | undefined> => {
        let clientIp: string | undefined;
        const innerService = {
            invoke: async (req: HttpRequest) => {
                clientIp = req.extensions.get(CLIENT_IP);
                return dummyResponse;
            },
        };

        let builder = HttpRequest.builder().connectInfo(
            new SocketAddress({ address: socketAddress }),
        );

        if (forwardedFor !== undefined) {
            builder = builder.header("x-forwarded-for", forwardedFor);
        }

        await new SetClientIpLayer(trustProxy).layer(innerService).invoke(builder.body(null));
        return clientIp;
    };

    it("throws when connect info is absent", async () => {
        const innerService = {
            invoke: async () => dummyResponse,
        };

        const layer = new SetClientIpLayer(false);
        const service = layer.layer(innerService);

        const req = HttpRequest.builder().body(null);

        await assert.rejects(async () => service.invoke(req), /requires connect info/);
    });

    it("inserts connectInfo.address as client IP when trustProxy is false", async () => {
        const connectInfo = new SocketAddress({ address: "192.168.1.100" });
        const innerService = {
            invoke: async (req: HttpRequest) => {
                assert.equal(req.extensions.get(CLIENT_IP), connectInfo.address);
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
                assert.equal(req.extensions.get(CLIENT_IP), "203.0.113.1");
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
                assert.equal(req.extensions.get(CLIENT_IP), connectInfo.address);
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
                assert.equal(req.extensions.get(CLIENT_IP), "203.0.113.1");
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
                assert.equal(req.extensions.get(CLIENT_IP), connectInfo.address);
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

    it("ignores a client-spoofed x-forwarded-for entry with a single trusted proxy", async () => {
        assert.equal(await clientIpFor(1, "10.0.0.1", "9.9.9.9, 203.0.113.7"), "203.0.113.7");
    });

    it("falls back to the socket peer when the trusted entry is not a valid IP", async () => {
        assert.equal(await clientIpFor(1, "10.0.0.1", "9.9.9.9, _hidden"), "10.0.0.1");
    });

    it("uses the rightmost entry with a single trusted proxy", async () => {
        assert.equal(await clientIpFor(1, "10.0.0.1", "203.0.113.1, 198.51.100.2"), "198.51.100.2");
    });

    it("walks two hops with two trusted proxies", async () => {
        assert.equal(await clientIpFor(2, "10.0.0.1", "203.0.113.1, 198.51.100.2"), "203.0.113.1");
    });

    it("falls back to the socket peer with a hop count and no x-forwarded-for", async () => {
        assert.equal(await clientIpFor(1, "10.0.0.1"), "10.0.0.1");
    });

    it("counts non-IP entries as positions instead of filtering them", async () => {
        assert.equal(
            await clientIpFor(2, "10.0.0.1", "203.0.113.1, junk, 198.51.100.2"),
            "10.0.0.1",
        );
    });

    it("throws for a negative or non-integer hop count", () => {
        assert.throws(() => new SetClientIpLayer(-1), /non-negative integer/);
        assert.throws(() => new SetClientIpLayer(1.5), /non-negative integer/);
    });

    it("uses the socket peer for a hop count of zero", async () => {
        assert.equal(await clientIpFor(0, "10.0.0.1", "203.0.113.1, 198.51.100.2"), "10.0.0.1");
    });

    it("clamps a hop count larger than the chain to the leftmost entry", async () => {
        assert.equal(await clientIpFor(99, "10.0.0.1", "203.0.113.1, 198.51.100.2"), "203.0.113.1");
    });

    it("uses the leftmost valid entry when trustProxy is true, skipping non-IP entries", async () => {
        assert.equal(
            await clientIpFor(true, "10.0.0.1", "_hidden, 203.0.113.1, 198.51.100.2"),
            "203.0.113.1",
        );
    });

    it("does not let client-prepended entries shift the trusted slot with two proxies", async () => {
        assert.equal(
            await clientIpFor(2, "10.0.0.1", "1.1.1.1, 2.2.2.2, 203.0.113.7, 192.168.0.5"),
            "203.0.113.7",
        );
    });

    it("resolves an IPv6 client IP in the hop-count path", async () => {
        assert.equal(await clientIpFor(1, "10.0.0.1", "2001:db8::1, 2001:db8::2"), "2001:db8::2");
    });
});
