import { isIP } from "node:net";
import { CONNECT_INFO, ExtensionKey, type HttpRequest, type HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

/**
 * Extension key which holds the client IP.
 */
export const CLIENT_IP = new ExtensionKey<string>("Client IP");

/**
 * A layer that extracts the client IP address from the request.
 *
 * By default the direct socket peer is used. When the app sits behind one or
 * more reverse proxies, pass the number of trusted proxies to derive the client
 * IP from the `x-forwarded-for` header in a way a client cannot spoof.
 *
 * The client IP can later be accessed through the {@link CLIENT_IP} extension
 * key.
 *
 * @example
 * ```ts
 * import { SetClientIpLayer } from "@taxum/core/middleware/client-ip";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World"))
 *     .layer(new SetClientIpLayer(1));
 * ```
 */
export class SetClientIpLayer implements HttpLayer {
    private readonly trustProxy: boolean | number;

    /**
     * Creates a new {@link SetClientIpLayer}.
     *
     * @param trustProxy - how to derive the client IP:
     *   - `false` (default): use the direct socket peer and ignore
     *     `x-forwarded-for`.
     *   - a number: the count of trusted reverse proxies in front of the app.
     *     The client IP is taken by skipping that many hops from the right of
     *     the forwarding chain (`[socket peer, ...x-forwarded-for reversed]`),
     *     which a client cannot spoof as long as the count matches the actual
     *     number of proxies. Pass `1` for a single proxy. If the entry at that
     *     position is not a valid IP, the socket peer is used.
     *   - `true`: use the leftmost `x-forwarded-for` entry. This trusts the
     *     entire forwarding chain, so any host along the way can inject a value.
     *     Only safe on a fully controlled network; prefer a trusted-hop count.
     * @throws {@link !Error} if a numeric hop count is negative or not an
     *         integer.
     */
    public constructor(trustProxy: boolean | number = false) {
        if (typeof trustProxy === "number" && (!Number.isInteger(trustProxy) || trustProxy < 0)) {
            throw new Error(`Trusted hop count must be a non-negative integer, got: ${trustProxy}`);
        }

        this.trustProxy = trustProxy;
    }

    public layer(inner: HttpService): HttpService {
        return new SetClientIp(inner, this.trustProxy);
    }
}

class SetClientIp implements HttpService {
    private readonly inner: HttpService;
    private readonly trustProxy: boolean | number;

    public constructor(inner: HttpService, trustProxy: boolean | number) {
        this.inner = inner;
        this.trustProxy = trustProxy;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const connectInfo = req.extensions.get(CONNECT_INFO);

        if (connectInfo === undefined) {
            throw new Error(
                "SetClientIp requires connect info. The CONNECT_INFO extension is inserted by " +
                    "HttpRequest.fromIncomingMessage(); when building requests manually, insert " +
                    "the extension yourself.",
            );
        }

        req.extensions.insert(CLIENT_IP, this.resolveClientIp(req, connectInfo.address));
        return this.inner.invoke(req);
    }

    private resolveClientIp(req: HttpRequest, socketAddress: string): string {
        if (this.trustProxy === false) {
            return socketAddress;
        }

        const forwardedFor = req.headers.get("x-forwarded-for");

        if (!forwardedFor) {
            return socketAddress;
        }

        const entries = forwardedFor.value
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);

        if (entries.length === 0) {
            return socketAddress;
        }

        if (this.trustProxy === true) {
            // Trust the whole chain: the leftmost claimed client, skipping any
            // non-IP entries.
            return entries.find((entry) => isIP(entry) !== 0) ?? socketAddress;
        }

        // Count trusted hops from the right of the forwarding chain. The positions
        // must be taken on the raw list: dropping non-IP entries first could pull
        // an untrusted value into a trusted slot when a trusted proxy emits a
        // non-IP token (an obfuscated identifier or a port-suffixed address). The
        // final selected value is validated instead, falling back to the socket
        // peer rather than to a value from beyond the trust boundary.
        const chain = [socketAddress, ...entries.reverse()];
        const candidate = chain[Math.min(this.trustProxy, chain.length - 1)];

        return isIP(candidate) !== 0 ? candidate : socketAddress;
    }
}
