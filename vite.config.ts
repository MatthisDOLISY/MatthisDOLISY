import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le client tourne sur 5173, l'API Express sur 8787.
// On proxifie /api vers Express en développement.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
  },
});
