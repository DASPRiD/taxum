import { isIP } from "node:net";
import { ExtensionKey, type HttpRequest, type HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

/**
 * Extension key which holds the client IP.
 */
export const CLIENT_IP = new ExtensionKey<string>("Client IP");

/**
 * A layer that extracts the client IP address from the request.
 *
 * If `trustProxy` is set to true, the `x-forwarded-for` header is considered.
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
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new SetClientIpLayer());
 * ```
 */
export class SetClientIpLayer implements HttpLayer {
    private readonly trustProxy: boolean;

    /**
     * Creates a new {@link SetClientIpLayer}.
     *
     * @param trustProxy - whether to trust proxy headers.
     */
    public constructor(trustProxy = false) {
        this.trustProxy = trustProxy;
    }

    public layer(inner: HttpService): HttpService {
        return new SetClientIp(inner, this.trustProxy);
    }
}

class SetClientIp implements HttpService {
    private readonly inner: HttpService;
    private readonly trustProxy: boolean;

    public constructor(inner: HttpService, trustProxy: boolean) {
        this.inner = inner;
        this.trustProxy = trustProxy;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        if (!this.trustProxy) {
            req.extensions.insert(CLIENT_IP, req.connectInfo.address);
            return this.inner.invoke(req);
        }

        const forwardedFor = req.headers.get("x-forwarded-for");

        if (!forwardedFor) {
            req.extensions.insert(CLIENT_IP, req.connectInfo.address);
            return this.inner.invoke(req);
        }

        const ips = forwardedFor.value
            .split(",")
            .map((ip) => ip.trim())
            .filter((ip) => isIP(ip) !== 0);

        if (ips.length === 0) {
            req.extensions.insert(CLIENT_IP, req.connectInfo.address);
            return this.inner.invoke(req);
        }

        req.extensions.insert(CLIENT_IP, ips[0]);
        return this.inner.invoke(req);
    }
}
