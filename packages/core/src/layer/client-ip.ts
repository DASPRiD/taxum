import { isIP } from "node:net";
import { ExtensionKey, type HttpRequest, type HttpResponse } from "../http/index.js";
import type { Layer, Service } from "../routing/index.js";

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
 * import { SetClientIpLayer } from "@taxum/core/layer/client-ip";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new SetClientIpLayer());
 * ```
 */
export class SetClientIpLayer implements Layer {
    private readonly trustProxy: boolean;

    /**
     * Creates a new {@link SetClientIpLayer}.
     *
     * @param trustProxy - whether to trust proxy headers.
     */
    public constructor(trustProxy = false) {
        this.trustProxy = trustProxy;
    }

    public layer(inner: Service): Service {
        return new SetClientIp(inner, this.trustProxy);
    }
}

class SetClientIp implements Service {
    private readonly inner: Service;
    private readonly trustProxy: boolean;

    public constructor(inner: Service, trustProxy: boolean) {
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

        const ips = forwardedFor
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
