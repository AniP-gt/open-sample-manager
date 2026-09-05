import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/__test__/setup.ts",
  },
  clearScreen: false,
  server: {
  port: 5174,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5175,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
