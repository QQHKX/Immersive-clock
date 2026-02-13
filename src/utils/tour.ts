import { driver, type Driver, type DriverHook, type PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";
import "../styles/tour.css";

const TOUR_STORAGE_KEY = "immersive-clock:has-seen-tour";

let currentDriver: Driver | null = null;

/**
 * 判断引导弹窗按钮是否“可作为默认焦点”的目标
 */
const isTourButtonUsable = (button?: HTMLButtonElement | null) => {
  if (!button) return false;
  if (button.disabled) return false;
  if (button.style.display === "none") return false;

  const rect = button.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
};

/**
 * 以微任务方式执行回调（优先使用 queueMicrotask，避免可见的 UI 闪烁）
 */
const scheduleMicrotask = (callback: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
};

/**
 * 以定时器的方式延后刷新 driver.js（用于等待 React 状态更新后的 DOM 变化）
 */
const scheduleDriverRefresh = (driverObj: { refresh: () => void }, delayMs = 80) => {
  setTimeout(() => {
    driverObj.refresh();
  }, delayMs);
};

/**
 * 安全地点击一个 selector 对应的元素（用于“辅助完成”引导步骤）
 */
const tryClickElement = (selector: string) => {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return false;
  el.click();
  return true;
};

/**
 * 判断当前是否处于自习模式（通过 tabpanel 的动态 id 判断）
 */
const isInStudyMode = () => {
  const panel = document.getElementById("study-panel");
  return !!panel && (typeof panel.isConnected !== "boolean" || panel.isConnected);
};

/**
 * 判断设置面板是否已打开（通过容器是否存在判断）
 */
const isSettingsPanelOpen = () => {
  const panel = document.getElementById("settings-panel-container");
  return !!panel && (typeof panel.isConnected !== "boolean" || panel.isConnected);
};

/**
 * 在引导弹窗中写入提示信息（用于阻止误跳步时的反馈）
 */
const setPopoverHint = (opts: { state: { popover?: PopoverDOM } }, message: string) => {
  const descriptionEl = opts.state.popover?.description;
  if (!descriptionEl) return;
  descriptionEl.textContent = message;
};

/**
 * 按当前状态更新“下一步”按钮文案（用于提示用户会触发辅助动作）
 */
const setNextButtonText = (popover: PopoverDOM, text: string) => {
  popover.nextButton.innerHTML = text;
};

/**
 * 创建“守卫式下一步”点击逻辑：未满足条件时不切步，并尝试辅助完成
 */
const createGuardedNextClick = (params: {
  isSatisfied: () => boolean;
  attemptResolve: () => void;
  hintAfterAttempt: string;
}): DriverHook => {
  return (_element, _step, opts) => {
    if (params.isSatisfied()) {
      opts.driver.moveNext();
      return;
    }

    params.attemptResolve();
    setPopoverHint(opts, params.hintAfterAttempt);
    const popover = opts.state.popover;
    if (popover) {
      setNextButtonText(popover, "下一步");
    }
    scheduleDriverRefresh(opts.driver);
  };
};

/**
 * 临时禁用按钮以影响 driver.js 的默认聚焦选择，并在微任务中恢复原状态
 */
const temporarilyDisableButtons = (buttons: Array<HTMLButtonElement | null | undefined>) => {
  const previousStates = buttons.map((button) => ({
    button,
    disabled: button?.disabled ?? false,
  }));

  previousStates.forEach(({ button, disabled }) => {
    if (!button) return;
    if (disabled) return;
    button.disabled = true;
  });

  return () => {
    previousStates.forEach(({ button, disabled }) => {
      if (!button) return;
      button.disabled = disabled;
    });
  };
};

/**
 * 让引导弹窗默认焦点落在“下一步”，而不是“上一步”或“X”
 */
const preferTourNextButtonAsDefaultFocus = (popover: {
  nextButton: HTMLButtonElement;
  previousButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
}) => {
  if (isTourButtonUsable(popover.nextButton)) {
    const restore = temporarilyDisableButtons([popover.closeButton, popover.previousButton]);
    scheduleMicrotask(restore);
    return;
  }

  if (isTourButtonUsable(popover.previousButton)) {
    const restore = temporarilyDisableButtons([popover.closeButton]);
    scheduleMicrotask(restore);
  }
};

/**
 * 检查用户是否已观看过指引
 */
export const hasSeenTour = () => {
  return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
};

/**
 * 标记指引为已观看
 */
export const markTourAsSeen = () => {
  localStorage.setItem(TOUR_STORAGE_KEY, "true");
};

/**
 * 检查指引是否正在运行
 */
export const isTourActive = () => {
  return currentDriver ? currentDriver.isActive() : false;
};

interface TourOptions {
  onStart?: () => void;
  switchMode?: (mode: string) => void;
  openSettings?: () => void;
  onEnd?: () => void;
}

/**
 * 判断本次销毁是否属于“完成指引”（停留在最后一步结束）
 */
const isTourCompleted = (opts: { config: { steps?: unknown[] }; state: { activeIndex?: number } }) => {
  const totalSteps = Array.isArray(opts.config.steps) ? opts.config.steps.length : 0;
  const activeIndex = typeof opts.state.activeIndex === "number" ? opts.state.activeIndex : -1;
  return totalSteps > 0 && activeIndex === totalSteps - 1;
};

/**
 * 启动新手指引
 * @param force 是否强制启动（忽略已观看状态）
 * @param options 配置选项
 */
export const startTour = (force = false, options?: TourOptions) => {
  if (!force && hasSeenTour()) {
    return;
  }

  // 指引开始时立即执行回调（显示 HUD）
  options?.onStart?.();

  // 派发全局事件通知指引开始
  window.dispatchEvent(new Event("tour:start"));

  const driverObj = driver({
    showProgress: true,
    allowClose: false,
    allowKeyboardControl: false,
    animate: true,
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    doneBtnText: "完成",
    onPopoverRender: (popover) => {
      preferTourNextButtonAsDefaultFocus(popover);
    },
    steps: [
      {
        popover: {
          title: "欢迎使用 Immersive Clock",
          description: "接下来将为您介绍一些常用操作，帮助您快速上手。点击“下一步”继续。",
          side: "left",
          align: "center",
          showButtons: ["next"],
        },
      },
      {
        element: "#tour-fullscreen-btn",
        popover: {
          title: "全屏模式",
          description: "点击这里进入全屏，获得更沉浸的显示效果。",
          side: "top",
          align: "end",
        },
      },
      {
        element: "#tour-mode-selector",
        popover: {
          title: "切换模式",
          description: "点击这里切换时钟、倒计时、秒表或自习模式。",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: "#mode-tab-study",
        popover: {
          title: "进入自习模式",
          description:
            "点击“帮我切换”可自动进入自习模式；进入成功后按钮会变为“下一步”，再继续即可。",
          side: "bottom",
          align: "center",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isInStudyMode() ? "下一步" : "帮我切换");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: isInStudyMode,
            attemptResolve: () => {
              const clicked = tryClickElement("#mode-tab-study");
              if (!clicked) {
                options?.switchMode?.("study");
              }
            },
            hintAfterAttempt:
              "已为您执行切换操作；若界面未变化，请手动点击“自习”。进入自习模式后，再点击“下一步”。",
          }),
        },
      },
      {
        element: '[data-tour="clock-area"]',
        popover: {
          title: "自习模式",
          description: "这是专为专注学习打造的模式，支持专注统计。",
          side: "top",
          align: "center",
        },
        onHighlightStarted: () => {
          // 确保 HUD 显示
          options?.onStart?.();
        },
      },
      {
        element: "#tour-settings-btn",
        popover: {
          title: "个性化设置",
          description:
            "点击“帮我打开”可自动打开设置面板；打开后按钮会变为“下一步”，再继续即可。",
          side: "top",
          align: "end",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isSettingsPanelOpen() ? "下一步" : "帮我打开");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: isSettingsPanelOpen,
            attemptResolve: () => {
              const clicked = tryClickElement("#tour-settings-btn");
              if (!clicked) {
                options?.openSettings?.();
              }
            },
            hintAfterAttempt:
              "已为您执行打开操作；若设置面板未出现，请手动点击“设置”。打开后，再点击“下一步”。",
          }),
        },
      },
      {
        element: "#settings-panel-container",
        popover: {
          title: "设置面板",
          description: "在这里可以配置各种偏好，例如界面显示、专注相关开关等。",
          side: "left",
          align: "center",
        },
        onHighlightStarted: () => {
          // 延迟刷新以确保 DOM 更新后能正确定位
          setTimeout(() => {
            if (currentDriver?.isActive()) {
              currentDriver.refresh();
            }
          }, 300);
        },
      },
      {
        element: "#settings-save-btn",
        popover: {
          title: "保存设置",
          description: "点击“完成”将自动保存设置并结束新手指引。",
          side: "top",
          align: "end",
          onNextClick: (_el, _step, opts) => {
            tryClickElement("#settings-save-btn");
            opts.driver.moveNext();
          },
        },
      },
    ],
    onDestroyed: () => {
      markTourAsSeen();
      currentDriver = null;
      options?.onEnd?.();
      if (isTourCompleted({ config: driverObj.getConfig(), state: driverObj.getState() })) {
        window.dispatchEvent(new Event("tour:completed"));
      }
      // 派发全局事件通知指引结束
      window.dispatchEvent(new Event("tour:end"));
    },
  });

  currentDriver = driverObj;
  driverObj.drive();
};
