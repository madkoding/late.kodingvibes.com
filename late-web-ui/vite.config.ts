import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// ponytail: microfront URLs are STABLE (no version in the path) so the
// browser can keep the bundle in cache across deploys. Nginx serves
// /micro/{radio,chat}/entry.js via a `latest` symlink that points at the
// most recent version. When a new version ships:
//   1. The new bundle replaces /micro/radio/v0.1.2/entry.js on disk.
//   2. The `latest` symlink is repointed at v0.1.2.
//   3. The next page load sees the same URL but the symlink now points
//      to the new file. The browser sends a conditional GET; nginx
//      answers 200 (new file) or 304 (unchanged) based on ETag.
// The shell's index.html is unchanged between micro releases, so the
// only thing the browser re-validates is the entry.js (and the CSS).
// Version bumps in the shell's package.json are the right time to
// touch the symlink.
//
// The version constants remain here as a deployment-time check
// (we still want the build to fail if the symlink points at a version
// the build pipeline doesn't know about). They are NOT used in the
// emitted HTML.
const MICRO_RADIO_VERSION = "v0.1.1";
const MICRO_CHAT_VERSION  = "v0.1.1";

const microfrontsPlugin: Plugin = {
  name: "late-microfronts",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      if (!ctx.filename.endsWith("index.html")) return html;
      // ponytail: use the `latest` symlink as the URL — nginx handles
      // the indirection. Same ETag policy (immutable 1y) but the URL
      // doesn't change between micro releases, so returning users hit
      // the browser's HTTP cache instead of re-downloading.
      const radio = `/micro/radio/latest`;
      const chat  = `/micro/chat/latest`;
      const tags = [
        `<link rel="stylesheet" href="${radio}/style.css">`,
        `<link rel="stylesheet" href="${chat}/style.css">`,
        `<script type="module" src="${radio}/entry.js"></script>`,
        `<script type="module" src="${chat}/entry.js"></script>`,
      ].join("\n    ");
      return html.replace("</body>", `    ${tags}\n  </body>`);
    },
  },
};

export default defineConfig({
  plugins: [microfrontsPlugin, react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps) => deps,
    },
    rollupOptions: {
      // React and react-dom live in /vendor/vendor.js, shared with the
      // microfronts via the import map. One React instance in the page,
      // no broken hooks / refs across microfronts.
      external: [
        "react", "react-dom", "react-dom/client", "react/jsx-runtime",
        /^https?:\/\//,
        /^\/micro\//,
      ],
      output: {
        manualChunks(id) {
          if (/node_modules\/(react-router-dom|scheduler)\//.test(id)) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
