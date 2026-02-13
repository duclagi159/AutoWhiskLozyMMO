import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  base: './',
  clearScreen: false,
  server: {
    port: 1234,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));