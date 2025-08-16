import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { type DefaultTheme, defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";
import { withMermaid } from "vitepress-plugin-mermaid";

let typedocSidebar: DefaultTheme.SidebarItem[];

try {
    typedocSidebar = JSON.parse(
        fs.readFileSync(
            fileURLToPath(new URL("../src/api/typedoc-sidebar.json", import.meta.url)),
            "utf-8",
        ),
    );
} catch {
    console.error(
        "typedoc-sidebar.json missing; did you forget to run `pnpm run build:api-docs` in root?",
    );
    process.exit(1);
}

export default withMermaid(
    defineConfig({
        title: "Taxum",
        description: "HTTP server framework",
        markdown: {
            config(md) {
                md.use(groupIconMdPlugin);
            },
        },
        vite: {
            plugins: [groupIconVitePlugin()],
        },
        head: [["link", { rel: "icon", type: "image/svg+xml", href: "/icon.svg" }]],
        themeConfig: {
            logo: { src: "/icon.svg", width: 24, height: 24 },

            editLink: {
                pattern: "https://github.com/dasprid/taxum/edit/main/packages/docs/src/:path",
                text: "Edit this page on GitHub",
            },

            search: {
                provider: "local",
            },

            nav: [
                { text: "Guide", link: "/guide" },
                { text: "API", link: "/api" },
            ],

            sidebar: {
                "/api/": typedocSidebar,
                "/guide/": [
                    {
                        text: "Introduction",
                        link: "/guide/introduction",
                    },
                    {
                        text: "Getting Started",
                        link: "/guide/getting-started",
                    },
                    {
                        text: "Core Concepts",
                        items: [
                            {
                                text: "Handlers",
                                link: "/guide/core-concepts/handlers",
                            },
                            {
                                text: "Extract Handlers",
                                link: "/guide/core-concepts/extract-handlers",
                            },
                            {
                                text: "Nesting",
                                link: "/guide/core-concepts/nesting",
                            },
                            {
                                text: "Middleware",
                                link: "/guide/core-concepts/middleware",
                            },
                            {
                                text: "Error Handling",
                                link: "/guide/core-concepts/error-handling",
                            },
                            {
                                text: "Extensions",
                                link: "/guide/core-concepts/extensions",
                            },
                            {
                                text: "Logging",
                                link: "/guide/core-concepts/logging",
                            },
                            {
                                text: "Testing",
                                link: "/guide/core-concepts/testing",
                            },
                        ],
                    },
                    {
                        text: "Layers",
                        items: [
                            {
                                text: "Compression",
                                link: "/guide/layers/compression",
                            },
                            {
                                text: "Decompression",
                                link: "/guide/layers/decompression",
                            },
                            {
                                text: "Request Body Limit",
                                link: "/guide/layers/limit",
                            },
                            {
                                text: "CORS",
                                link: "/guide/layers/cors",
                            },
                            {
                                text: "Client IP",
                                link: "/guide/layers/client-ip",
                            },
                            {
                                text: "Request ID",
                                link: "/guide/layers/request-id",
                            },
                        ],
                    },
                    {
                        text: "Addons",
                        items: [
                            {
                                text: "JWT authentication",
                                link: "/guide/addons/jwt",
                            },
                            {
                                text: "Serving Static Files",
                                link: "/guide/addons/fs",
                            },
                        ],
                    },
                ],
            },

            socialLinks: [{ icon: "github", link: "https://github.com/dasprid/jsonapi-serde-js" }],
        },
        srcDir: "src",
    }),
);
