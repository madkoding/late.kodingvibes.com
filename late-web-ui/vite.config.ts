import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Proxy Icecast status endpoint so the SPA can fetch metadata without CORS.
      "/status-json.xsl": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
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
      output: {
        manualChunks(id) {
          if (/node_modules\/(react\/|react-dom\/|react-router-dom\/|scheduler\/)/.test(id)) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
