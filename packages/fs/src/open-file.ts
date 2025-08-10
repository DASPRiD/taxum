/* node:coverage disable: c8 gets confused by the module mocking */
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import { Encoding, type HttpRequest, Method } from "@taxum/core/http";
import mime from "mime";
import parseRange, { type Ranges } from "range-parser";
import type { ServeVariant } from "./serve-dir.js";
import { isErrnoException } from "./util.js";
/* node:coverage enable */

export type Extent =
    | {
          type: "full";
          file: fs.FileHandle;
          stats: Stats;
      }
    | {
          type: "head";
          stats: Stats;
      };

export type OpenFileOutput =
    | {
          type: "file_opened";
          extent: Extent;
          mime: string;
          encoding: Encoding | null;
          range: Ranges | Error | null;
          lastModified: Date;
      }
    | {
          type: "redirect";
          location: string;
      }
    | { type: "file_not_found" }
    | { type: "precondition_failed" }
    | { type: "not_modified" };

export const openFile = async (
    variant: ServeVariant,
    path: string,
    req: HttpRequest,
    negotiatedEncodings: [Encoding, number][],
    rangeHeader: string | null,
): Promise<OpenFileOutput> => {
    const ifUnmodifiedSince = parseDateHeader(req.headers.get("if-unmodified-since"));
    const ifModifiedSince = parseDateHeader(req.headers.get("if-modified-since"));

    const pathRef: PathRef = { path };
    let mimeType: string;

    if (variant.inner.type === "directory") {
        const output = await maybeRedirectOrAppendPath(
            pathRef,
            req.uri,
            variant.inner.appendIndexHtmlOnDirectories,
        );

        if (output) {
            return output;
        }

        mimeType = mime.getType(pathRef.path) ?? "application/octet-stream";
    } else {
        mimeType = variant.inner.mime;
    }

    if (req.method.equals(Method.HEAD)) {
        const [stats, encoding] = await fileMetadataWithFallback(path, negotiatedEncodings);
        const lastModified = stats.mtimeMs;
        const output = checkModifiedHeaders(lastModified, ifUnmodifiedSince, ifModifiedSince);

        if (output) {
            return output;
        }

        const range = tryParseRange(rangeHeader, stats.size);

        return {
            type: "file_opened",
            extent: { type: "head", stats },
            mime: mimeType,
            encoding: encoding,
            lastModified: stats.mtime,
            range,
        };
    }

    const [file, encoding] = await openFileWithFallback(path, negotiatedEncodings);
    const stats = await file.stat();
    const lastModified = stats.mtimeMs;
    const output = checkModifiedHeaders(lastModified, ifUnmodifiedSince, ifModifiedSince);

    if (output) {
        await file.close();
        return output;
    }

    const range = tryParseRange(rangeHeader, stats.size);

    return {
        type: "file_opened",
        extent: { type: "full", file, stats },
        mime: mimeType,
        encoding: encoding,
        lastModified: stats.mtime,
        range,
    };
};

const parseDateHeader = (header: string | null): number | null => {
    if (!header) {
        return null;
    }

    const date = Date.parse(header);

    if (Number.isNaN(date)) {
        return null;
    }

    return date;
};

const openFileWithFallback = async (
    path: string,
    negotiatedEncoding: readonly [Encoding, number][],
): Promise<[fs.FileHandle, Encoding | null]> => {
    const pathRef: PathRef = { path };
    let encodings = [...negotiatedEncoding];

    while (true) {
        const encoding = preferredEncoding(pathRef, encodings);

        try {
            const file = await fs.open(pathRef.path, "r");
            return [file, encoding];
        } catch (error) {
            if (!(encoding && isErrnoException(error) && error.code === "ENOENT")) {
                throw error;
            }

            pathRef.path = pathRef.path.replace(/\.[a-z]+$/, "");
            encodings = encodings.filter(([current]) => current !== encoding);
        }
    }
};

const fileMetadataWithFallback = async (
    path: string,
    negotiatedEncoding: readonly [Encoding, number][],
): Promise<[Stats, Encoding | null]> => {
    const pathRef: PathRef = { path };
    let encodings = [...negotiatedEncoding];

    while (true) {
        const encoding = preferredEncoding(pathRef, encodings);

        try {
            const stats = await fs.stat(pathRef.path);
            return [stats, encoding];
        } catch (error) {
            if (!(encoding && isErrnoException(error) && error.code === "ENOENT")) {
                throw error;
            }

            pathRef.path = pathRef.path.replace(/\.[a-z]+$/, "");
            encodings = encodings.filter(([current]) => current !== encoding);
        }
    }
};

const checkModifiedHeaders = (
    modifiedMs: number,
    ifUnmodifiedSinceMs: number | null,
    ifModifiedSinceMs: number | null,
): OpenFileOutput | null => {
    const modified = Math.floor(modifiedMs / 1000);
    const ifUnmodifiedSince =
        ifUnmodifiedSinceMs !== null ? Math.floor(ifUnmodifiedSinceMs / 1000) : null;
    const ifModifiedSince =
        ifModifiedSinceMs !== null ? Math.floor(ifModifiedSinceMs / 1000) : null;

    if (ifUnmodifiedSince !== null && modified > ifUnmodifiedSince) {
        return { type: "precondition_failed" };
    }

    if (ifModifiedSince !== null && modified <= ifModifiedSince) {
        return { type: "not_modified" };
    }

    return null;
};

const preferredEncoding = (
    pathRef: PathRef,
    negotiatedEncoding: [Encoding, number][],
): Encoding | null => {
    const preferredEncoding = Encoding.preferredEncoding(negotiatedEncoding);

    if (!preferredEncoding) {
        return null;
    }

    /* node:coverage ignore next 3: can never happen, just for safety */
    if (!preferredEncoding.fileExtension) {
        return preferredEncoding;
    }

    pathRef.path += preferredEncoding.fileExtension;
    return preferredEncoding;
};

const maybeRedirectOrAppendPath = async (
    pathRef: PathRef,
    uri: URL,
    appendIndexHtmlOnDirectories: boolean,
): Promise<OpenFileOutput | null> => {
    if (!(await isDir(pathRef.path))) {
        return null;
    }

    if (!appendIndexHtmlOnDirectories) {
        return { type: "file_not_found" };
    }

    if (uri.pathname.endsWith("/")) {
        pathRef.path += "index.html";
        return null;
    }

    const newUri = appendSlashOnPath(uri);
    return { type: "redirect", location: newUri.toString() };
};

const appendSlashOnPath = (uri: URL): URL => {
    const newUri = new URL(uri);
    newUri.pathname += "/";
    return newUri;
};

const tryParseRange = (rangeHeader: string | null, fileSize: number): Ranges | Error | null => {
    if (!rangeHeader) {
        return null;
    }

    const ranges = parseRange(fileSize, rangeHeader);

    if (ranges === -1) {
        return new Error("Unsatisfiable range");
    }

    if (ranges === -2) {
        return new Error("Invalid range");
    }

    /* node:coverage ignore next 3: disallowed by the parser, but for safety */
    if (ranges.type !== "bytes") {
        return new Error("Only byte ranges are supported");
    }

    return ranges;
};

const isDir = async (path: string): Promise<boolean> => {
    try {
        return (await fs.stat(path)).isDirectory();
    } catch {
        return false;
    }
};

type PathRef = { path: string };
