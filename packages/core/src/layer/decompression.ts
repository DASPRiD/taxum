import type { Transform } from "node:stream";
import zlib from "node:zlib";
import { HttpResponse, StatusCode } from "../http/index.js";
import { HttpRequest } from "../http/request.js";
import type { Layer } from "../routing/index.js";

export type Encoding = "deflate" | "gzip" | "brotli" | "zstd";
export type RequestDecompressionConfig = {
    accept?: Set<Encoding>;
    passThroughUnaccepted?: boolean;
};

/**
 * Layer that adds decompression to request bodies.
 */
export const requestDecompressionLayer = (config?: RequestDecompressionConfig): Layer => {
    const accept: Set<Encoding> = config?.accept ?? new Set(["deflate", "gzip", "brotli", "zstd"]);
    const passThroughUnaccepted = config?.passThroughUnaccepted ?? false;
    const acceptEncodingHeader = toAcceptEncodingHeader(accept);

    return {
        layer: (inner) => async (req) => {
            const contentEncoding = req.headers.get("content-encoding");

            if (!contentEncoding) {
                return inner(req);
            }

            const body = req.body;
            let decompressionStream: Transform;

            switch (contentEncoding) {
                case "deflate": {
                    decompressionStream = zlib.createInflate();
                    break;
                }

                case "gzip": {
                    decompressionStream = zlib.createGunzip();
                    break;
                }

                case "br": {
                    decompressionStream = zlib.createBrotliDecompress();
                    break;
                }

                case "zstd": {
                    decompressionStream = zlib.createZstdDecompress();
                    break;
                }

                case "identity":
                    return inner(req);

                default: {
                    if (passThroughUnaccepted) {
                        return inner(req);
                    }

                    return HttpResponse.builder()
                        .status(StatusCode.UNSUPPORTED_MEDIA_TYPE)
                        .header("accept-encoding", acceptEncodingHeader)
                        .body(null);
                }
            }

            req.headers.remove("content-encoding");
            req.headers.remove("content-length");

            body.pipe(decompressionStream);

            return inner(new HttpRequest(req.head, decompressionStream));
        },
    };
};

const toAcceptEncodingHeader = (encodings: Set<Encoding>): string => {
    if (encodings.size === 0) {
        return "identity";
    }

    const values = [];

    if (encodings.has("deflate")) {
        values.push("deflate");
    }

    if (encodings.has("gzip")) {
        values.push("gzip");
    }

    if (encodings.has("brotli")) {
        values.push("br");
    }

    if (encodings.has("zstd")) {
        values.push("zstd");
    }

    return values.join(",");
};
