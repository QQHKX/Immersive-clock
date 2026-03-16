import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    hmr: false,
    ws: false,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/setupTests.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", "dist-electron/**"],
  },
});
