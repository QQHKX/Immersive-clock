import { defineConfig } from "vitest/config";

/**
 * Vitest 配置（函数级注释）：
 * - 使用 jsdom 环境模拟浏览器
 * - 启用覆盖率统计与 HTML/LCOV 报告
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**/*", "dist/**/*", "tests/e2e/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      all: false,
      include: ["src/utils/**/*.{ts,tsx}", "src/services/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
