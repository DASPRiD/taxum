import type { Parts } from "../../http/request.js";

export type AllowPrivateNetworkPredicate = (origin: string, parts: Parts) => boolean;

export class AllowPrivateNetwork {
    private readonly inner: boolean | AllowPrivateNetworkPredicate;

    private constructor(inner: boolean | AllowPrivateNetworkPredicate) {
        this.inner = inner;
    }

    public static default(): AllowPrivateNetwork {
        return AllowPrivateNetwork.no();
    }

    public static yes(): AllowPrivateNetwork {
        return new AllowPrivateNetwork(true);
    }

    public static no(): AllowPrivateNetwork {
        return new AllowPrivateNetwork(false);
    }

    public static predicate(predicate: AllowPrivateNetworkPredicate): AllowPrivateNetwork {
        return new AllowPrivateNetwork(predicate);
    }

    /**
     * @internal
     */
    public toHeader(origin: string | null, parts: Parts): [string, string] | null {
        const REQUEST_PRIVATE_NETWORK = "access-control-request-private-network";
        const ALLOW_PRIVATE_NETWORK = "access-control-allow-private-network";

        if (!this.inner) {
            return null;
        }

        if (parts.headers.get(REQUEST_PRIVATE_NETWORK) !== "true") {
            return null;
        }

        if (typeof this.inner === "function" && !(origin && this.inner(origin, parts))) {
            return null;
        }

        return [ALLOW_PRIVATE_NETWORK, "true"];
    }
}
