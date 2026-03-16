import { spawn } from "node:child_process";

/**
 * 确保 Playwright 浏览器已准备好（函数级注释）：
 * - 默认不下载浏览器（使用系统浏览器 channel，如 msedge）
 * - 当显式设置 PW_BUNDLED_BROWSERS=1 时，才执行 playwright install
 */
async function ensurePlaywrightBrowsers() {
  const shouldInstall = String(process.env.PW_BUNDLED_BROWSERS || "").trim() === "1";
  if (!shouldInstall) return;

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["playwright", "install"],
      { stdio: "inherit" }
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`playwright install failed: exit code ${code}`));
    });
    child.on("error", reject);
  });
}

await ensurePlaywrightBrowsers();

