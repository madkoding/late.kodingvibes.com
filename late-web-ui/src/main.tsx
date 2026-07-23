import React from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root not found in index.html");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);


