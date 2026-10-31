import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production must be embeddable and offline:
//  - base './' so the bundle loads relative to the MyGo/browser entry,
//  - modulePreload polyfill OFF so no inline <script> is injected (CSP script-src 'self'),
//  - no CDN, no remote assets; runtime fetches (/themes, /sounds, /rpc, /events)
//    stay root-relative, matching the Go embedded server contract.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    // Disable the inline modulepreload polyfill entirely: it is the only inline
    // script Vite injects and would be blocked by script-src 'self'.
    modulePreload: false,
    assetsInlineLimit: 0,
  },
});
