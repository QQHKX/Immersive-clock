import { expect, test } from "@playwright/test";
import { showHud } from "./e2eUtils";

/** 端到端用例：验证自习模式关键入口可见（函数级注释） */
test("自习模式：面板与设置入口可见", async ({ page }) => {
  await page.goto("/");

  await showHud(page);
  const tablist = page.getByRole("tablist", { name: "选择时钟模式" });
  await tablist.getByRole("tab", { name: /自习/ }).click();

  await expect(page.locator("#study-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "打开设置" })).toBeVisible();
});
