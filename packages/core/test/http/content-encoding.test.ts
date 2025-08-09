import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    Encoding,
    encodings,
    HeaderMap,
    parseQValue,
    type SupportedEncodings,
} from "../../src/http/index.js";

describe("http:content-encoding", () => {
    const supportedEncodings: SupportedEncodings = {
        gzip: () => true,
        deflate: () => true,
        br: () => true,
        zstd: () => true,
    };

    describe("Encoding.parse", () => {
        it("parses known encodings when supported", () => {
            assert.equal(Encoding.parse("gzip", supportedEncodings), Encoding.GZIP);
            assert.equal(Encoding.parse("x-gzip", supportedEncodings), Encoding.GZIP);
            assert.equal(Encoding.parse("deflate", supportedEncodings), Encoding.DEFLATE);
            assert.equal(Encoding.parse("br", supportedEncodings), Encoding.BROTLI);
            assert.equal(Encoding.parse("zstd", supportedEncodings), Encoding.ZSTD);
            assert.equal(Encoding.parse("identity", supportedEncodings), Encoding.IDENTITY);
        });

        it("returns null for unsupported encodings", () => {
            const unsupported: SupportedEncodings = {
                gzip: () => false,
                deflate: () => false,
                br: () => false,
                zstd: () => false,
            };

            assert.equal(Encoding.parse("gzip", unsupported), null);
            assert.equal(Encoding.parse("deflate", unsupported), null);
            assert.equal(Encoding.parse("br", unsupported), null);
            assert.equal(Encoding.parse("zstd", unsupported), null);
            assert.equal(Encoding.parse("identity", unsupported), Encoding.IDENTITY);
            assert.equal(Encoding.parse("unknown", supportedEncodings), null);
        });

        it("is case insensitive", () => {
            assert.equal(Encoding.parse("GZIP", supportedEncodings), Encoding.GZIP);
            assert.equal(Encoding.parse("X-GZIP", supportedEncodings), Encoding.GZIP);
            assert.equal(Encoding.parse("Deflate", supportedEncodings), Encoding.DEFLATE);
            assert.equal(Encoding.parse("BR", supportedEncodings), Encoding.BROTLI);
            assert.equal(Encoding.parse("ZSTD", supportedEncodings), Encoding.ZSTD);
            assert.equal(Encoding.parse("IDENTITY", supportedEncodings), Encoding.IDENTITY);
        });
    });

    describe("parseQValue", () => {
        it("parses valid q-values correctly", () => {
            assert.equal(parseQValue("q=1"), 1000);
            assert.equal(parseQValue("q=0"), 0);
            assert.equal(parseQValue("q=0.5"), 500);
            assert.equal(parseQValue("q=0.123"), 123);
            assert.equal(parseQValue("q=0.999"), 999);
            assert.equal(parseQValue("q=1.000"), 1000);
        });

        it("returns null for invalid inputs", () => {
            assert.equal(parseQValue(""), null);
            assert.equal(parseQValue("q="), null);
            assert.equal(parseQValue("q=1.001"), null);
            assert.equal(parseQValue("q=1.1"), null);
            assert.equal(parseQValue("q=2"), null);
            assert.equal(parseQValue("p=0.5"), null);
            assert.equal(parseQValue("q=abc"), null);
            assert.equal(parseQValue("q=0.1234"), null);
        });
    });

    const createHeaders = (values: string[]): HeaderMap => {
        const headers = new HeaderMap();

        for (const value of values) {
            headers.append("accept-encoding", value);
        }

        return headers;
    };

    describe("encodings()", () => {
        it("parses multiple encodings with q-values", () => {
            const headers = createHeaders([
                "gzip, deflate;q=0.5, br;q=0.8",
                "zstd;q=0.9, identity;q=0",
            ]);

            const result = encodings(headers, supportedEncodings);

            assert.deepEqual(
                result.map(([encoding, q]) => [encoding.value, q]),
                [
                    ["gzip", 1000],
                    ["deflate", 500],
                    ["br", 800],
                    ["zstd", 900],
                    ["identity", 0],
                ],
            );
        });

        it("ignores unsupported encodings", () => {
            const unsupported: SupportedEncodings = {
                gzip: () => false,
                deflate: () => true,
                br: () => false,
                zstd: () => false,
            };
            const headers = createHeaders(["gzip, deflate, br"]);

            const result = encodings(headers, unsupported);

            assert.deepEqual(
                result.map(([encoding]) => encoding.value),
                ["deflate"],
            );
        });

        it("ignores invalid q-values and encodings", () => {
            const headers = createHeaders([
                "gzip;q=abc, deflate;q=0.5, unknown;q=0.9, br;q=2, zstd;q=0.8",
            ]);

            const result = encodings(headers, supportedEncodings);

            assert.deepEqual(
                result.map(([encoding, q]) => [encoding.value, q]),
                [
                    ["deflate", 500],
                    ["zstd", 800],
                ],
            );
        });

        it("returns empty array if no accept-encoding headers", () => {
            const headers = createHeaders([]);
            assert.deepEqual(encodings(headers, supportedEncodings), []);
        });
    });

    describe("Encoding.preferredEncoding", () => {
        it("returns null if no accepted encodings", () => {
            assert.equal(Encoding.preferredEncoding([]), null);
            assert.equal(Encoding.preferredEncoding([[Encoding.GZIP, 0]]), null);
        });

        it("returns encoding with highest q-value", () => {
            const accepted: [Encoding, number][] = [
                [Encoding.DEFLATE, 500],
                [Encoding.GZIP, 700],
                [Encoding.BROTLI, 600],
            ];
            assert.equal(Encoding.preferredEncoding(accepted), Encoding.GZIP);
        });

        it("returns first encoding if multiple have highest q-value", () => {
            const accepted: [Encoding, number][] = [
                [Encoding.DEFLATE, 700],
                [Encoding.GZIP, 700],
                [Encoding.BROTLI, 600],
            ];
            assert.equal(Encoding.preferredEncoding(accepted), Encoding.DEFLATE);
        });
    });

    describe("Encoding.fromHeaders", () => {
        it("returns preferred encoding based on headers and supported encodings", () => {
            const headers = createHeaders(["gzip, br;q=0.8, deflate;q=0.5"]);
            const encoding = Encoding.fromHeaders(headers, supportedEncodings);
            assert.equal(encoding, Encoding.GZIP);
        });

        it("returns identity if none acceptable", () => {
            const headers = createHeaders(["identity;q=0"]);
            const encoding = Encoding.fromHeaders(headers, supportedEncodings);
            assert.equal(encoding, Encoding.IDENTITY);
        });

        it("returns identity if no accept-encoding headers", () => {
            const headers = createHeaders([]);
            const encoding = Encoding.fromHeaders(headers, supportedEncodings);
            assert.equal(encoding, Encoding.IDENTITY);
        });
    });
});
