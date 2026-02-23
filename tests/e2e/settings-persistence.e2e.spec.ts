import { expect, test } from "@playwright/test";
import { showHud } from "./e2eUtils";

/** 端到端用例：验证设置保存后写入本地存储且刷新后仍生效（函数级注释） */
test("设置持久化：修改目标年份并保存", async ({ page }) => {
  await page.goto("/");

  await showHud(page);
  const tablist = page.getByRole("tablist", { name: "选择时钟模式" });
  await tablist.getByRole("tab", { name: /自习/ }).click();

  await page.getByRole("button", { name: "打开设置" }).click();

  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "高考" }).click();

  const targetYearInput = dialog
    .locator('label:has-text("目标年份")')
    .locator("..")
    .locator("input");
  await targetYearInput.fill("2029");

  await dialog.getByRole("button", { name: "保存" }).click();

  const storedYear = await page.evaluate(() => {
    const raw = localStorage.getItem("AppSettings");
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.study?.targetYear ?? null;
    } catch {
      return null;
    }
  });
  expect(storedYear).toBe(2029);

  await page.reload();
  const storedYearAfterReload = await page.evaluate(() => {
    const raw = localStorage.getItem("AppSettings");
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.study?.targetYear ?? null;
    } catch {
      return null;
    }
  });
  expect(storedYearAfterReload).toBe(2029);
});

/** 端到端用例：切换“错误与调试-记录方式”时不应在保存前清空持久化记录（函数级注释） */
test("错误与调试：记录方式切换延迟到保存", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        study: {
          alerts: {
            errorCenterMode: "persist",
            errorPopup: true,
          },
        },
      })
    );
    localStorage.setItem(
      "error-center.records",
      JSON.stringify([
        {
          id: "e2e-1",
          ts: Date.now(),
          lastTs: Date.now(),
          level: "error",
          source: "e2e",
          title: "e2e",
          message: "e2e",
          count: 1,
        },
      ])
    );
  });

  await page.goto("/");

  await showHud(page);
  const tablist = page.getByRole("tablist", { name: "选择时钟模式" });
  await tablist.getByRole("tab", { name: /自习/ }).click();

  await page.getByRole("button", { name: "打开设置" }).click();

  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("tab", { name: "关于" }).click();

  const beforeSwitch = await page.evaluate(() => localStorage.getItem("error-center.records"));
  expect(beforeSwitch).not.toBeNull();

  const recordModeGroup = dialog.getByRole("radiogroup", { name: "记录方式" });
  await recordModeGroup.getByRole("button", { name: "关闭" }).click();

  const afterSwitchBeforeSave = await page.evaluate(() =>
    localStorage.getItem("error-center.records")
  );
  expect(afterSwitchBeforeSave).not.toBeNull();

  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toBeHidden();

  const afterCancel = await page.evaluate(() => localStorage.getItem("error-center.records"));
  expect(afterCancel).not.toBeNull();

  await page.getByRole("button", { name: "打开设置" }).click();
  const dialog2 = page.getByRole("dialog", { name: "设置" });
  await expect(dialog2).toBeVisible();
  await dialog2.getByRole("tab", { name: "关于" }).click();

  const recordModeGroup2 = dialog2.getByRole("radiogroup", { name: "记录方式" });
  await expect(recordModeGroup2.getByRole("button", { name: "持久化" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await recordModeGroup2.getByRole("button", { name: "关闭" }).click();
  await dialog2.getByRole("button", { name: "保存" }).click();
  await expect(dialog2).toBeHidden();

  const afterSave = await page.evaluate(() => localStorage.getItem("error-center.records"));
  expect(afterSave).toBeNull();
});
