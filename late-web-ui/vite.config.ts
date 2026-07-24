import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// ponytail: microfront URLs are STABLE (no version in the path) so the
// browser keeps the bundle in cache across deploys. Nginx serves
// /micro/{radio,chat}/entry.js via a `latest` symlink that points at
// the most recent version. New deploy replaces the symlink target;
// the browser re-validates on next page load via ETag, no shell
// redeploy required.
const microfrontsPlugin: Plugin = {
  name: "late-microfronts",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      if (!ctx.filename.endsWith("index.html")) return html;
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
