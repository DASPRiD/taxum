import type { HttpRequest } from "../http/index.js";
import { type HttpLayer, layerFn } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

export class StripPrefix<T> implements HttpService<T> {
    private readonly inner: HttpService<T>;
    private readonly prefix: string;

    public constructor(inner: HttpService<T>, prefix: string) {
        this.inner = inner;
        this.prefix = prefix;
    }

    public static layer<T>(prefix: string): HttpLayer<T, T> {
        return layerFn((inner) => {
            return new StripPrefix(inner, prefix);
        });
    }

    public async invoke(req: HttpRequest): Promise<T> {
        const strippedUri = stripPrefix(req.uri, this.prefix);

        const newReq = strippedUri ? req.withUri(strippedUri) : req;
        return this.inner.invoke(newReq);
    }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: slightly over is fine
const stripPrefix = (uri: URL, prefix: string): URL | null => {
    let matchingPrefixLength: number | null = 0;

    mainLoop: for (const item of zipLongest(segments(uri.pathname), segments(prefix))) {
        matchingPrefixLength += 1;

        switch (item.type) {
            case "both": {
                const { a: pathSegment, b: prefixSegment } = item;

                if (isCapture(prefixSegment) || pathSegment === prefixSegment) {
                    matchingPrefixLength += pathSegment.length;
                } else if (prefixSegment.length === 0) {
                    // Prefix ended in `/`, so the match is done
                    break mainLoop;
                } else {
                    matchingPrefixLength = null;
                    break mainLoop;
                }
                break;
            }

            case "first": {
                // Path has more segments than prefix — match done
                break mainLoop;
            }

            case "second": {
                // Prefix has more segments than the path — no match
                matchingPrefixLength = null;
                break mainLoop;
            }
        }
    }

    if (matchingPrefixLength === null) {
        return null;
    }

    const afterPrefix = uri.pathname.substring(matchingPrefixLength);
    /* node:coverage ignore next */
    const newPath = afterPrefix.startsWith("/") ? afterPrefix : `/${afterPrefix}`;
    const newUri = new URL(uri);
    newUri.pathname = newPath;
    return newUri;
};

const segments = (s: string): string[] => {
    if (!s.startsWith("/")) {
        throw new Error("path didn't start with '/'.");
    }

    return s.split("/").slice(1);
};

type ZipItem<T> = { type: "both"; a: T; b: T } | { type: "first"; a: T } | { type: "second"; b: T };

const zipLongest = function* <T>(a: Iterable<T>, b: Iterable<T>): Generator<ZipItem<T>> {
    const ai = a[Symbol.iterator]();
    const bi = b[Symbol.iterator]();

    while (true) {
        const an = ai.next();
        const bn = bi.next();

        if (an.done && bn.done) {
            break;
        }

        if (!(an.done || bn.done)) {
            yield { type: "both", a: an.value, b: bn.value };
        } else if (!an.done) {
            yield { type: "first", a: an.value };
            /* node:coverage ignore next 3: it's actually covered, but c8 falsely reports uncovered*/
        } else if (!bn.done) {
            yield { type: "second", b: bn.value };
        }
    }
};

const isCapture = (segment: string): boolean => {
    return segment === "*" || segment.startsWith(":");
};
