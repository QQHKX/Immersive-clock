import { test, expect } from "@playwright/test";

/** 端到端用例：验证首页加载与核心布局元素（函数级注释） */
test("首页可以正常加载并展示主时钟界面", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/沉浸式时钟/i);

  const main = page.getByRole("main", { name: "时钟应用主界面" });
  await expect(main).toBeVisible();

  await expect(
    main.locator("#clock-panel, #countdown-panel, #stopwatch-panel, #study-panel")
  ).toBeVisible();
});
