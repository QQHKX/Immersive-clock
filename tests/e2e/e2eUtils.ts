import { expect, type Page } from "@playwright/test";

/**
 * 关闭可能遮挡交互的启动弹窗（函数级注释）：
 * - 公告/欢迎弹窗可能在首屏出现并拦截点击
 * - 用例应先关闭弹窗再进行 HUD 与按钮交互
 */
export async function dismissBlockingModals(page: Page) {
  const systemAnnouncementDialog = page.getByRole("dialog", { name: "系统公告" });

  const clickCloseIfVisible = async () => {
    try {
      const closeButtonInDialog = systemAnnouncementDialog.getByRole("button", {
        name: "关闭模态框",
      });
      if (await closeButtonInDialog.isVisible()) {
        await closeButtonInDialog.click();
        return;
      }
    } catch {
      // ignore
    }

    try {
      const closeButton = page.getByRole("button", { name: "关闭模态框" }).first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    } catch {
      // ignore
    }
  };

  await clickCloseIfVisible();

  try {
    await page.keyboard.press("Escape");
  } catch {
    // ignore
  }

  await clickCloseIfVisible();

  try {
    await systemAnnouncementDialog.waitFor({ state: "visible", timeout: 2500 });
    await clickCloseIfVisible();
  } catch {
    // ignore
  }

  try {
    await expect(systemAnnouncementDialog).toBeHidden({ timeout: 5000 });
  } catch {
    // ignore
  }
}

/**
 * 显示 HUD 并等待模式切换入口可用（函数级注释）：
 * - HUD 默认隐藏，需要点击主界面或按键触发显示
 * - 用于稳定获取 tablist 与 toolbar 相关元素
 */
export async function showHud(page: Page) {
  await dismissBlockingModals(page);

  const main = page.getByRole("main", { name: "时钟应用主界面" });
  await main.click({ position: { x: 20, y: 20 } });

  await expect(page.getByRole("tablist", { name: "选择时钟模式" })).toBeVisible();

  return { main };
}
