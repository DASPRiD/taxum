import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MethodFilter } from "../../src/routing/index.js";

describe("routing:method-filter", () => {
    describe("MethodFilter", () => {
        it("matches itself", () => {
            assert(MethodFilter.GET.contains(MethodFilter.GET));
            assert(MethodFilter.POST.contains(MethodFilter.POST));
        });

        it("does not match other filters", () => {
            assert(!MethodFilter.GET.contains(MethodFilter.POST));
            assert(!MethodFilter.HEAD.contains(MethodFilter.OPTIONS));
        });

        it("can combine filters with or()", () => {
            const getOrPost = MethodFilter.GET.or(MethodFilter.POST);

            assert(getOrPost.contains(MethodFilter.GET));
            assert(getOrPost.contains(MethodFilter.POST));
            assert(!getOrPost.contains(MethodFilter.PUT));
        });

        it("can combine multiple filters recursively", () => {
            const all = MethodFilter.GET.or(MethodFilter.POST)
                .or(MethodFilter.PUT)
                .or(MethodFilter.DELETE);

            assert(all.contains(MethodFilter.GET));
            assert(all.contains(MethodFilter.POST));
            assert(all.contains(MethodFilter.PUT));
            assert(all.contains(MethodFilter.DELETE));
            assert(!all.contains(MethodFilter.TRACE));
        });

        it("GET and HEAD are distinct filters", () => {
            assert(!MethodFilter.GET.contains(MethodFilter.HEAD));
            assert(!MethodFilter.HEAD.contains(MethodFilter.GET));
        });
    });
});
