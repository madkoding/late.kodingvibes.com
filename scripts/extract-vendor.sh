#!/usr/bin/env bash
# Build a single shared ESM bundle of react, react-dom, and react-dom/client
# into /var/www/html/vendor/vendor.js. The shell and the microfronts all
# import "react" etc., and the import map in index.html points those
# specifiers at this file. Sharing the vendor keeps a single React instance
# in the page (no broken hooks / refs across microfronts).
#
# We use Vite (which uses Rollup under the hood) because its CJS->ESM
# interop produces real named exports. esbuild's star re-export of CJS
# collapses into `export default { ... }` which the browser can't
# destructure via `import { useState } from "react"`.
set -euo pipefail

UI_DIR="/root/late.kodingvibes.com/late-web-ui"
DEST="/var/www/html/vendor"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

export PATH="/root/.nvm/versions/node/v24.18.0/bin:$PATH"

cd "$UI_DIR"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi

mkdir -p "$DEST"
rm -f "$DEST/vendor.js"

# Write the entry that re-exports everything we need. Explicit exports
# instead of `export *` so Rollup's commonjs plugin produces real named
# exports in the output (star re-exports of CJS collapse to default).
cat > "$STAGE/entry.js" <<'EOF'
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSXRuntime from "react/jsx-runtime";

const re = (mod, keys) => {
  const out = {};
  for (const k of keys) out[k] = mod[k];
  return out;
};

const reactKeys = [
  "Children", "Component", "Fragment", "Profiler", "PureComponent",
  "StrictMode", "Suspense", "cloneElement", "createContext", "createElement",
  "createRef", "forwardRef", "isValidElement", "lazy", "memo", "useCallback",
  "useContext", "useDebugValue", "useDeferredValue", "useEffect", "useId",
  "useImperativeHandle", "useInsertionEffect", "useLayoutEffect", "useMemo",
  "useReducer", "useRef", "useState", "useSyncExternalStore", "useTransition",
  "version",
];
const reactDOMKeys = [
  "createPortal", "findDOMNode", "flushSync", "render", "unmountComponentAtNode",
  "unstable_batchedUpdates", "version",
];
const reactDOMClientKeys = ["createRoot", "hydrateRoot"];
const jsxRuntimeKeys = ["jsx", "jsxs", "Fragment"];

for (const [k, v] of Object.entries(re(React, reactKeys)))         export { k, v };
EOF
# That above pattern doesn't work as written; rewrite cleanly.
cat > "$STAGE/entry.js" <<'EOF'
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSXRuntime from "react/jsx-runtime";

export default React;

export const Children = React.Children;
export const Component = React.Component;
export const Fragment = React.Fragment;
export const Profiler = React.Profiler;
export const PureComponent = React.PureComponent;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const createRef = React.createRef;
export const forwardRef = React.forwardRef;
export const isValidElement = React.isValidElement;
export const lazy = React.lazy;
export const memo = React.memo;
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useEffect = React.useEffect;
export const useId = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useInsertionEffect = React.useInsertionEffect;
export const useLayoutEffect = React.useLayoutEffect;
export const useMemo = React.useMemo;
export const useReducer = React.useReducer;
export const useRef = React.useRef;
export const useState = React.useState;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useTransition = React.useTransition;
export const version = React.version;

export const createPortal = ReactDOM.createPortal;
export const findDOMNode = ReactDOM.findDOMNode;
export const flushSync = ReactDOM.flushSync;
export const render = ReactDOM.render;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const unstable_batchedUpdates = ReactDOM.unstable_batchedUpdates;
// Note: ReactDOM.version is omitted because it would clash with
// React.version above. Callers that need react-dom's version can
// import it from a separate path.

export const createRoot = ReactDOMClient.createRoot;
export const hydrateRoot = ReactDOMClient.hydrateRoot;

export const jsx = JSXRuntime.jsx;
export const jsxs = JSXRuntime.jsxs;
EOF

cat > "$STAGE/build-vendor.mjs" <<EOF
import { build } from "vite";
import replace from "@rollup/plugin-replace";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ui = ${UI_DIR@Q};
const nm = (p) => resolve(ui, "node_modules", p);

await build({
  configFile: false,
  root: ui,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env": "({})",
      },
    }),
  ],
  build: {
    outDir: resolve(here, "out"),
    emptyOutDir: true,
    minify: "esbuild",
    target: "es2022",
    lib: {
      entry: resolve(here, "entry.js"),
      formats: ["es"],
      fileName: () => "vendor.js",
    },
    rollupOptions: {
      external: [],
    },
    write: true,
  },
  resolve: {
    alias: [
      { find: /^react$/, replacement: nm("react/index.js") },
      { find: /^react\/jsx-runtime$/, replacement: nm("react/jsx-runtime.js") },
      { find: /^react-dom$/, replacement: nm("react-dom/index.js") },
      { find: /^react-dom\/client$/, replacement: nm("react-dom/client.js") },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  logLevel: "warn",
});
EOF

cd "$STAGE"
npm install --no-audit --no-fund vite@5.4.11 @rollup/plugin-replace@5 2>&1 | tail -3
node "$STAGE/build-vendor.mjs"

cp -f "$STAGE/out/vendor.js" "$DEST/vendor.js"

# Sanity: vendor.js should contain real named exports and no `process.env`.
grep -q 'useState' "$DEST/vendor.js" || { echo "no useState in vendor"; exit 1; }
grep -q 'createRoot' "$DEST/vendor.js" || { echo "no createRoot in vendor"; exit 1; }
grep -q 'createElement' "$DEST/vendor.js" || { echo "no createElement in vendor"; exit 1; }
grep -q 'jsx' "$DEST/vendor.js" || { echo "no jsx in vendor"; exit 1; }
grep -q 'process\.env' "$DEST/vendor.js" && { echo "WARN: vendor still references process.env"; }

# Detect the "star re-export collapsed to default" failure mode.
# esbuild emits `export { jsx as jsx, useState as useState, ... }` (named).
# A failed bundle emits `export default { jsx, useState, ... }` only.
if head -c 200 "$DEST/vendor.js" | grep -qE '^export\s*default\s*\{'; then
  echo "FATAL: vendor collapsed to default export. esbuild CJS interop problem."
  exit 1
fi

ls -la "$DEST"
echo "vendor.js: $(wc -c < "$DEST/vendor.js") bytes"
