import { expect, test } from "@playwright/test";
import { showHud } from "./e2eUtils";

/** 端到端用例：验证四种模式可切换并渲染对应面板（函数级注释） */
test("模式切换：时钟/倒计时/秒表/自习", async ({ page }) => {
  await page.goto("/");

  await showHud(page);
  const tablist = page.getByRole("tablist", { name: "选择时钟模式" });
  await expect(tablist).toBeVisible();

  await tablist.getByRole("tab", { name: /时钟/ }).click();
  await expect(page.locator("#clock-panel")).toBeVisible();

  await tablist.getByRole("tab", { name: /倒计时/ }).click();
  await expect(page.locator("#countdown-panel")).toBeVisible();

  await tablist.getByRole("tab", { name: /秒表/ }).click();
  await expect(page.locator("#stopwatch-panel")).toBeVisible();

  await tablist.getByRole("tab", { name: /自习/ }).click();
  await expect(page.locator("#study-panel")).toBeVisible();
});
