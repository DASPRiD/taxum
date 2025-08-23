import { type HeaderEntry, HeaderValue } from "../../http/index.js";
import type { Parts } from "../../http/request.js";

export type AllowPrivateNetworkPredicate = (origin: string, parts: Parts) => boolean;

/**
 * Holds configuration for how to set the `Access-Control-Allow-Private-Network` header.
 *
 * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Private-Network)
 * @see {@link CorsLayer.allowPrivateNetwork}
 */
export class AllowPrivateNetwork {
    private readonly inner: boolean | AllowPrivateNetworkPredicate;

    private constructor(inner: boolean | AllowPrivateNetworkPredicate) {
        this.inner = inner;
    }

    public static default(): AllowPrivateNetwork {
        return AllowPrivateNetwork.no();
    }

    public static from(like: AllowPrivateNetworkLike): AllowPrivateNetwork {
        if (like instanceof AllowPrivateNetwork) {
            return like;
        }

        if (typeof like === "boolean") {
            return like ? AllowPrivateNetwork.yes() : AllowPrivateNetwork.no();
        }

        return AllowPrivateNetwork.predicate(like);
    }

    /**
     * Allows private network requests.
     */
    public static yes(): AllowPrivateNetwork {
        return new AllowPrivateNetwork(true);
    }

    /**
     * Disallows private network requests.
     */
    public static no(): AllowPrivateNetwork {
        return new AllowPrivateNetwork(false);
    }

    /**
     * Allows private network requests, based on a given predicate.
     */
    public static predicate(predicate: AllowPrivateNetworkPredicate): AllowPrivateNetwork {
        return new AllowPrivateNetwork(predicate);
    }

    /**
     * @internal
     */
    public toHeader(origin: HeaderValue | null, parts: Parts): HeaderEntry | null {
        const REQUEST_PRIVATE_NETWORK = "access-control-request-private-network";
        const ALLOW_PRIVATE_NETWORK = "access-control-allow-private-network";

        if (!this.inner) {
            return null;
        }

        if (parts.headers.get(REQUEST_PRIVATE_NETWORK)?.value !== "true") {
            return null;
        }

        if (typeof this.inner === "function" && !(origin && this.inner(origin.value, parts))) {
            return null;
        }

        return [ALLOW_PRIVATE_NETWORK, new HeaderValue("true")];
    }
}

export type AllowPrivateNetworkLike = AllowPrivateNetwork | boolean | AllowPrivateNetworkPredicate;
