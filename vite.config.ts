
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Usar base relativa './' permite que o app funcione em qualquer subpasta (ex: GitHub Pages)
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  }
});
