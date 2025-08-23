import type { HeaderMap } from "./headers.js";

export type SupportedEncodings = {
    gzip(): boolean;
    deflate(): boolean;
    br(): boolean;
    zstd(): boolean;
};

/**
 * Represents various content encodings used for compression and decompression.
 *
 * This class is used to define well-known encoding formats, provide
 * functionality for parsing and resolving encodings based on client preferences
 * or available support and determine the preferred encoding from a list of
 * accepted encodings.
 *
 * Encodings are defined as static constants in this class, such as GZIP,
 * DEFLATE, etc. Each encoding includes a string identifier and an optional
 * file extension.
 *
 * Instances of this class cannot be directly instantiated and must be accessed
 * via the static constants or methods provided.
 */
export class Encoding {
    public static readonly IDENTITY = new Encoding("identity", null);
    public static readonly DEFLATE = new Encoding("deflate", ".zz");
    public static readonly GZIP = new Encoding("gzip", ".gz");
    public static readonly BROTLI = new Encoding("br", ".br");
    public static readonly ZSTD = new Encoding("zstd", ".zstd");

    /**
     * Value of the encoding as represented in headers.
     */
    public readonly value: string;

    /**
     * File extension associated with the encoding, if any.
     */
    public readonly fileExtension: string | null;

    private constructor(value: string, fileExtension: string | null) {
        this.value = value;
        this.fileExtension = fileExtension;
    }

    /**
     * @internal
     */
    public static parse(value: string, supportedEncodings: SupportedEncodings): Encoding | null {
        const normalized = value.toLowerCase();

        if ((normalized === "gzip" || normalized === "x-gzip") && supportedEncodings.gzip()) {
            return Encoding.GZIP;
        }

        if (normalized === "deflate" && supportedEncodings.deflate()) {
            return Encoding.DEFLATE;
        }

        if (normalized === "br" && supportedEncodings.br()) {
            return Encoding.BROTLI;
        }

        if (normalized === "zstd" && supportedEncodings.zstd()) {
            return Encoding.ZSTD;
        }

        if (normalized === "identity") {
            return Encoding.IDENTITY;
        }

        return null;
    }

    /**
     * Determines the preferred encoding from the provided headers and
     * supported encodings.
     */
    public static fromHeaders(
        headers: HeaderMap,
        supportedEncodings: SupportedEncodings,
    ): Encoding {
        return (
            Encoding.preferredEncoding(encodings(headers, supportedEncodings)) ?? Encoding.IDENTITY
        );
    }

    /**
     * Determines the preferred encoding from a list of accepted encodings and
     * their associated quality values.
     */
    public static preferredEncoding(acceptedEncodings: [Encoding, number][]): Encoding | null {
        const encodings = acceptedEncodings.filter(([_, qValue]) => qValue > 0);

        if (encodings.length === 0) {
            return null;
        }

        return encodings.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    }
}

/**
 * Parses the `accept-encoding` headers and returns a list of pairings of
 * supported encodings and their associated quality values (q-values).
 */
export const encodings = (
    headers: HeaderMap,
    supportedEncodings: SupportedEncodings,
): [Encoding, number][] => {
    return headers
        .getAll("accept-encoding")
        .flatMap((value) => value.value.split(","))
        .map((value) => value.trim())
        .reduce<[Encoding, number][]>((results, value) => {
            const values = value.split(";", 2);
            const encoding = Encoding.parse(values[0], supportedEncodings);

            if (!encoding) {
                return results;
            }

            const qValue = values.length === 1 ? 1000 : parseQValue(values[1]);

            if (qValue === null) {
                return results;
            }

            results.push([encoding, qValue]);
            return results;
        }, []);
};

const qValueRegex = /^[01](?:.\d{0,3})?$/;

/**
 * Parses a Q-value string from an input and returns its numerical
 * representation.
 *
 * The Q-value string is a weight factor used in HTTP headers, typically in the
 * format "q=value", where the value is a floating-point number between 0 and 1
 * inclusive with up to three decimal places.
 *
 * The returned value is multiplied by 1000 to ensure it's an integer between
 * 0 and 1000 inclusive. If the input is invalid or the Q-value is not within
 * the valid range, null is returned.
 */
export const parseQValue = (value: string): number | null => {
    const normalized = value.toLowerCase().split("=", 2);

    if (normalized[0] !== "q") {
        return null;
    }

    if (!qValueRegex.test(normalized[1])) {
        return null;
    }

    const qValue = Math.round(Number.parseFloat(normalized[1]) * 1000);
    return qValue <= 1000 ? qValue : null;
};
