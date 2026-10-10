import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// One multi-page build: each screen gets its own bundle, so phones never
// download projector/host code.
export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, "dist/web"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        play: resolve(import.meta.dirname, "web/index.html"),
        screen: resolve(import.meta.dirname, "web/screen.html"),
        host: resolve(import.meta.dirname, "web/host.html"),
      },
    },
  },
  server: {
    proxy: { "/socket.io": { target: "http://localhost:3000", ws: true } },
  },
});
