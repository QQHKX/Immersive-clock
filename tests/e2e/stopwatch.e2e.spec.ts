import { expect, test } from "@playwright/test";
import { showHud } from "./e2eUtils";

/** 端到端用例：验证秒表可开始、暂停与重置（函数级注释） */
test("秒表：开始/暂停/重置", async ({ page }) => {
  await page.goto("/");

  await showHud(page);
  const tablist = page.getByRole("tablist", { name: "选择时钟模式" });
  await tablist.getByRole("tab", { name: /秒表/ }).click();

  const toolbar = page.getByRole("toolbar", { name: "时钟控制" });
  const timeArea = page.locator("#stopwatch-panel").locator('[aria-live="polite"]');

  await expect(timeArea).toContainText("00:00:00");

  await toolbar.getByRole("button", { name: "开始秒表" }).click();
  await expect(toolbar.getByRole("button", { name: "暂停秒表" })).toBeVisible();
  await expect(timeArea).not.toContainText("00:00:00");

  await toolbar.getByRole("button", { name: "暂停秒表" }).click();
  await expect(toolbar.getByRole("button", { name: "开始秒表" })).toBeVisible();

  await toolbar.getByRole("button", { name: "重置秒表" }).click();
  await expect(timeArea).toContainText("00:00:00");
});
