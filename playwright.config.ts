import { defineConfig } from "@playwright/test";

/**
 * Playwright 端到端测试配置（函数级注释）：
 * - 使用 Vite 开发服务器作为被测应用
 * - 配置基础多浏览器并行与 HTML 报告
 */
const useBundledBrowsers = String(process.env.PW_BUNDLED_BROWSERS || "").trim() === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3005",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3005",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
  projects: useBundledBrowsers
    ? [
        { name: "chromium", use: { browserName: "chromium" } },
        { name: "firefox", use: { browserName: "firefox" } },
        { name: "webkit", use: { browserName: "webkit" } },
      ]
    : [{ name: "msedge", use: { browserName: "chromium", channel: "msedge" } }],
});
