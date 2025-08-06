import { isIP } from "node:net";
import { ExtensionKey } from "../http/index.js";
import type { Layer } from "../routing/index.js";

/**
 * Extension key which holds the client IP.
 */
export const CLIENT_IP = new ExtensionKey<string>("Client IP");

/**
 * Layer that extracts the client IP address from the request.
 *
 * If `trustProxy` is set to true, the `x-forwarded-for` header is considered.
 *
 * The client IP can later be accessed through the {@link CLIENT_IP} extension
 * key.
 */
export const clientIpLayer = (trustProxy: boolean): Layer => ({
    layer: (inner) => (req) => {
        if (!trustProxy) {
            req.extensions.insert(CLIENT_IP, req.connectInfo.address);
            return inner(req);
        }

        const forwardedFor = req.headers.get("x-forwarded-for");

        if (!forwardedFor) {
            req.extensions.insert(CLIENT_IP, req.connectInfo.address);
            return inner(req);
        }

        const ips = forwardedFor
            .split(",")
            .map((ip) => ip.trim())
            .filter((ip) => isIP(ip) !== 0);

        if (ips.length === 0) {
            req.extensions.insert(CLIENT_IP, req.connectInfo.address);
            return inner(req);
        }

        req.extensions.insert(CLIENT_IP, ips[0]);
        return inner(req);
    },
});
