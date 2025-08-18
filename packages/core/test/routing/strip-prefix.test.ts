import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpRequest, HttpResponse } from "../../src/http/index.js";
import { StripPrefix } from "../../src/routing/strip-prefix.js";
import type { HttpService } from "../../src/service/index.js";

describe("routing:strip-prefix", () => {
    const testCases: [string, string, string | null, string][] = [
        ["/", "/", "/", "matches root path and root prefix, path remains root"],
        ["/a", "/a", "/", "removes exact matching single segment"],
        ["/", "/a", null, "does not match different root segment"],
        ["/a", "/", "/a", "keeps path when prefix is root"],
        ["/a", "/b", null, "does not match different single segment"],
        ["/a/", "/a/", "/", "removes matching segment with trailing slash"],
        ["/a", "/a/", null, "does not match prefix with trailing slash when URI lacks it"],
        ["/a/", "/a", "/", "removes trailing slash when prefix lacks it"],
        ["/a/b", "/a", "/b", "removes first segment from multi-segment path"],
        ["/b/a", "/a", null, "does not match when first segment differs"],
        ["/a", "/a/b", null, "does not match longer prefix"],
        ["/a/b", "/b", null, "does not match non-leading segment"],
        ["/a/b/", "/a/b/", "/", "removes exact multi-segment with trailing slash"],
        ["/a/b", "/a/b/", null, "does not match prefix with trailing slash on shorter URI"],
        ["/a/b/", "/a/b", "/", "removes trailing slash from multi-segment prefix"],
        ["/", "/:param", "/", "matches root path with param"],
        ["/a", "/:param", "/", "removes single segment with param"],
        ["/a/b", "/:param", "/b", "removes first segment via param"],
        ["/b/a", "/:param", "/a", "removes first segment via param with different segment"],
        ["/a/b", "/a/:param", "/", "removes matching static + param"],
        ["/b/a", "/a/:param", null, "does not match static+param when static part differs"],
        ["/a/b", "/:param/a", null, "does not match param+static when static part mismatches"],
        ["/b/a", "/:param/a", "/", "removes param+static from start"],
        ["/a/b/c", "/a/:param/c", "/", "removes static+param+static sequence"],
        ["/c/b/a", "/a/:param/c", null, "does not match static+param+static with wrong start"],
        ["/a/", "/:param", "/", "removes segment with trailing slash via param"],
        ["/a", "/:param/", null, "does not match param with trailing slash when URI lacks it"],
        ["/a/", "/:param/", "/", "removes param with trailing slash"],
        ["/a/a", "/a/", "/a", "removes static segment and keeps rest"],
        ["/a/b", "/a/b/c", null, "does not match longer prefix with multiple segments"],
    ];

    for (const [uriPath, prefix, expected, name] of testCases) {
        it(name, async () => {
            const expectedPath = expected ?? uriPath;

            const innerService: HttpService = {
                invoke: async (req) => {
                    assert.equal(req.uri.pathname, expectedPath);
                    return HttpResponse.builder().body(null);
                },
            };

            const layer = StripPrefix.layer(prefix);
            const service = layer.layer(innerService);

            const req = HttpRequest.builder().path(uriPath).body(null);
            await service.invoke(req);
        });
    }

    it("throws if prefix does not start with '/'", async () => {
        const innerService: HttpService = {
            invoke: async () => HttpResponse.builder().body(null),
        };

        const layer = StripPrefix.layer("a");
        const service = layer.layer(innerService);
        const req = HttpRequest.builder().path("/a").body(null);

        await assert.rejects(async () => {
            await service.invoke(req);
        }, /path didn't start with '\/'./);
    });
});
