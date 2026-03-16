import {
  driver,
  type Config,
  type Driver,
  type DriverHook,
  type PopoverDOM,
  type State,
} from "driver.js";
import "driver.js/dist/driver.css";

import { AppMode } from "../types";

const TOUR_STORAGE_KEY = "immersive-clock:has-seen-tour";

let currentDriver: Driver | null = null;
let calibrationBaselineAtEnter: number | null = null;

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
 * 多次尝试聚焦按钮（函数级注释：规避 driver.js 内部异步聚焦导致焦点落在“上一步/关闭”上的竞态）
 */
const focusButtonWithRetries = (button: HTMLButtonElement, retries = 3) => {
  let remaining = Math.max(0, retries);

  const tryFocusOnce = () => {
    if (remaining <= 0) return;
    remaining -= 1;

    if (!button.isConnected) return;
    if (button.disabled) return;

    const rect = button.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    button.focus();
    if (document.activeElement === button) return;

    setTimeout(tryFocusOnce, 60);
  };

  scheduleMicrotask(tryFocusOnce);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(tryFocusOnce);
  }
  setTimeout(tryFocusOnce, 0);
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
 * 判断设置面板顶部分类 Tab 是否已激活
 */
const isSettingsCategoryActive = (key: "basic" | "monitor") => {
  const tab = document.getElementById(key);
  if (!tab) return false;
  return tab.getAttribute("aria-selected") === "true";
};

/**
 * 读取“基准噪音值”滑块当前值（用于判断用户是否已手动修正）
 */
const getNoiseBaselineSliderValue = () => {
  const input = document.querySelector(
    '#tour-noise-baseline-slider input[type="range"]'
  ) as HTMLInputElement | null;
  if (!input) return null;
  const v = Number.parseFloat(input.value);
  return Number.isFinite(v) ? v : null;
};

/**
 * 判断噪音是否已校准（通过校准状态 DOM 文案判断）
 */
const isNoiseCalibrated = () => {
  const el = document.querySelector('[data-tour="noise-calibration-status"]');
  const text = el?.textContent ?? "";
  return text.includes("已校准");
};

/**
 * 判断噪音历史记录弹窗是否已打开
 */
const isNoiseHistoryModalOpen = () => {
  const modal = document.querySelector('[data-tour="noise-history-modal"]');
  return (
    !!modal &&
    (typeof (modal as HTMLElement).isConnected !== "boolean" || (modal as HTMLElement).isConnected)
  );
};

/**
 * 等待条件成立后再进入下一步（用于跨 React 状态切换后的稳定过渡）
 */
const waitForConditionThenMoveNext = (params: {
  driverObj: Driver;
  condition: () => boolean;
  timeoutMs?: number;
  intervalMs?: number;
  waitAfterSatisfiedMs?: number;
}) => {
  const {
    driverObj,
    condition,
    timeoutMs = 2400,
    intervalMs = 60,
    waitAfterSatisfiedMs = 0,
  } = params;
  const startedAt = Date.now();
  const tick = () => {
    if (!driverObj.isActive()) return;
    if (condition()) {
      if (waitAfterSatisfiedMs > 0) {
        setTimeout(() => {
          if (driverObj.isActive()) driverObj.moveNext();
        }, waitAfterSatisfiedMs);
      } else {
        driverObj.moveNext();
      }
      return;
    }
    if (Date.now() - startedAt >= timeoutMs) {
      driverObj.moveNext();
      return;
    }
    setTimeout(tick, intervalMs);
  };
  tick();
};

/**
 * 创建“自动动作”点击逻辑：点击下一步时尝试自动执行动作，等待条件满足后切步
 */
const createAutoNextClick = (params: {
  check: () => boolean;
  action: () => void;
  hint?: string;
  timeoutMs?: number;
  waitAfterSatisfiedMs?: number;
}): DriverHook => {
  return (_element, _step, opts) => {
    if (params.check()) {
      opts.driver.moveNext();
      return;
    }
    params.action();
    if (params.hint) {
      applyTourAutoActionHint(opts.state?.popover, params.hint);
    }
    normalizeTourNextButtonLabel(opts.state?.popover);
    waitForConditionThenMoveNext({
      driverObj: opts.driver,
      condition: params.check,
      timeoutMs: params.timeoutMs,
      waitAfterSatisfiedMs: params.waitAfterSatisfiedMs,
    });
  };
};

/**
 * 更新引导弹窗的辅助提示文案
 */
const applyTourAutoActionHint = (popover: PopoverDOM | undefined, hint: string) => {
  const desc = popover?.description;
  if (!desc) return;
  const current = desc.textContent ?? "";
  if (current.includes(hint)) return;
  desc.textContent = current ? `${current} ${hint}` : hint;
};

/**
 * 统一“下一步”按钮文案（例如从“帮我切换”恢复为“下一步”）
 */
const normalizeTourNextButtonLabel = (popover: PopoverDOM | undefined) => {
  const nextButton = popover?.nextButton;
  if (!nextButton) return;
  const current = nextButton.innerHTML || "";
  if (!current || current === "下一步") return;
  nextButton.innerHTML = "下一步";
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
 * 手动添加关闭按钮（因为 allowClose: false 禁用了所有关闭方式，需手动补回按钮以仅允许按钮退出）
 */
const ensureCloseButton = (popover: PopoverDOM, driver: Driver) => {
  if (!popover.wrapper) {
    return;
  }

  if (popover.wrapper.querySelector(".driver-popover-close-btn")) {
    return;
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "driver-popover-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "退出指引";
  closeBtn.onclick = () => {
    driver.destroy();
  };

  popover.wrapper.appendChild(closeBtn);
};

/**
 * 让引导弹窗默认焦点落在“下一步”，而不是“上一步”或“X”
 */
const preferTourNextButtonAsDefaultFocus = (popover: PopoverDOM, opts: { driver: Driver }) => {
  // 确保关闭按钮存在（因为 allowClose: false）
  ensureCloseButton(popover, opts.driver);

  if (!opts.driver.isActive()) return;

  const canNext = isTourButtonUsable(popover.nextButton);
  const canPrev = isTourButtonUsable(popover.previousButton);

  if (canNext) {
    // 这里的 popover.closeButton 可能是 null，因为 allowClose: false
    // 如果我们手动添加了按钮，它不在 popover.closeButton 引用中，但可以通过 DOM 获取
    const manualCloseBtn = popover.wrapper?.querySelector(
      ".driver-popover-close-btn"
    ) as HTMLButtonElement | null;
    const restore = temporarilyDisableButtons([
      popover.closeButton,
      manualCloseBtn,
      popover.previousButton,
    ]);
    if (popover.nextButton) focusButtonWithRetries(popover.nextButton, 4);
    setTimeout(() => restore(), 160);
    return;
  }

  if (canPrev) {
    const manualCloseBtn = popover.wrapper?.querySelector(
      ".driver-popover-close-btn"
    ) as HTMLButtonElement | null;
    const restore = temporarilyDisableButtons([popover.closeButton, manualCloseBtn]);
    if (popover.previousButton) focusButtonWithRetries(popover.previousButton, 3);
    setTimeout(() => restore(), 160);
  }
};

type TourPopoverRenderHook = (
  popover: PopoverDOM,
  opts: { config: Config; state: State; driver: Driver }
) => void;

/**
 * 组合引导弹窗渲染回调（函数级注释：driver.js 的 step.onPopoverRender 会覆盖全局 onPopoverRender，因此需显式合并以保证默认焦点始终落在“下一步”）
 */
const composeTourPopoverRender = (render?: TourPopoverRenderHook): TourPopoverRenderHook => {
  return (popover, opts) => {
    render?.(popover, opts);
    preferTourNextButtonAsDefaultFocus(popover, { driver: opts.driver });
  };
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
  switchMode?: (mode: AppMode) => void;
  openSettings?: () => void;
  onEnd?: () => void;
}

/**
 * 启动新手指引
 * @param force 是否强制启动（忽略已观看状态）
 * @param options 配置选项
 */
export const startTour = (force = false, options?: TourOptions) => {
  if (!force && hasSeenTour()) {
    return;
  }

  calibrationBaselineAtEnter = null;
  let isDoneClicked = false;

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
    onPopoverRender: (popover, opts) => {
      preferTourNextButtonAsDefaultFocus(popover, { driver: opts.driver });
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
          description: "自习模式是我们的特色模式，接下来带你进入。",
          side: "bottom",
          align: "center",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: isInStudyMode,
            action: () => {
              const clicked = tryClickElement("#mode-tab-study");
              if (!clicked) {
                options?.switchMode?.("study");
              }
            },
            hint: "已为您执行切换操作",
          }),
        },
      },
      {
        element: '[data-tour="clock-area"]',
        popover: {
          title: "自习模式",
          description:
            "这是专为教室多媒体大屏打造的模式，支持噪音监测与统计、在线励志语句、天气显示与预警等等。",
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
          description: "在这个不起眼的角落藏着设置面板，这里有极度丰富的各种偏好设置。",
          side: "top",
          align: "end",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: isSettingsPanelOpen,
            action: () => {
              const clicked = tryClickElement("#tour-settings-btn");
              if (!clicked) {
                options?.openSettings?.();
              }
            },
            hint: "已为您执行打开操作",
            waitAfterSatisfiedMs: 400, // 等待设置面板动画完成
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
      },
      {
        element: "#monitor",
        popover: {
          title: "监测设置",
          description: "上方可以切换各种类型的设置分类，比如这里可以配置噪音监测功能。",
          side: "bottom",
          align: "center",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: () => isSettingsCategoryActive("monitor"),
            action: () => tryClickElement("#monitor"),
            hint: "已为您执行切换操作",
          }),
        },
      },

      {
        element: '[data-tour="noise-calibration"]',
        popover: {
          title: "校准噪音值",
          description: "这里是噪音校准功能，校准完成后你会获得更精确的分贝显示。",
          side: "top",
          align: "center",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: () => {
              const baselineValue = getNoiseBaselineSliderValue();
              const baselineChanged =
                baselineValue !== null &&
                calibrationBaselineAtEnter !== null &&
                Math.abs(baselineValue - calibrationBaselineAtEnter) >= 0.5;
              return isNoiseCalibrated() || baselineChanged;
            },
            action: () => {
              // 移除 calibrationAttemptedInTour = true;
              tryClickElement("#tour-noise-calibrate-btn");
            },
            hint: "已为您触发校准操作",
            timeoutMs: 8000,
          }),
        },
        onHighlightStarted: () => {
          const baselineValue = getNoiseBaselineSliderValue();
          calibrationBaselineAtEnter = baselineValue;
          const el = document.querySelector(
            '[data-tour="noise-calibration"]'
          ) as HTMLElement | null;
          el?.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" });
        },
      },
      {
        element: "#settings-save-btn",
        popover: {
          title: "保存设置",
          description: "点击“下一步”自动保存设置并返回自习页面，然后继续教您打开历史记录。",
          side: "top",
          align: "end",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: () => !isSettingsPanelOpen(),
            action: () => tryClickElement("#settings-save-btn"),
          }),
        },
      },
      {
        element: '[data-tour="noise-monitor"]',
        popover: {
          title: "打开历史记录",
          description: "看见这个会变色呼吸灯了吗，点击它就可以打开历史记录管理页面了。",
          side: "right",
          align: "center",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: isNoiseHistoryModalOpen,
            action: () => {
              const clicked = tryClickElement('[data-tour="noise-history-trigger"]');
              if (!clicked) {
                tryClickElement('[data-tour="noise-monitor"]');
              }
            },
          }),
        },
        onHighlightStarted: () => {
          options?.onStart?.();
        },
      },
      {
        element: '[data-tour="noise-history-modal"]',
        popover: {
          title: "历史记录管理",
          description:
            "这里可以查看最近保存天数内的噪音历史，这里有目前最先进的噪音分析报告。但如果你是新用户你应该还没有任何数据。",
          side: "left",
          align: "center",
        },
      },
      {
        element: '[data-tour="noise-history-close"]',
        popover: {
          title: "退出历史界面",
          description: "点击“下一步”自动关闭历史记录弹窗并返回自习页面。",
          side: "left",
          align: "end",
          onPopoverRender: composeTourPopoverRender(),
          onNextClick: createAutoNextClick({
            check: () => !isNoiseHistoryModalOpen(),
            action: () => tryClickElement('[data-tour="noise-history-close"]'),
          }),
        },
      },
      {
        popover: {
          title: "完成新手指引",
          description: "您已完成新手指引，感谢使用沉浸式时钟！",
          side: "left",
          align: "center",
          onNextClick: (_el, _step, opts) => {
            isDoneClicked = true;
            opts.driver.destroy();
          },
        },
      },
    ],
    onDestroyed: () => {
      markTourAsSeen();
      currentDriver = null;
      options?.onEnd?.();
      if (isDoneClicked) {
        window.dispatchEvent(new Event("tour:completed"));
      }
      // 派发全局事件通知指引结束
      window.dispatchEvent(new Event("tour:end"));
    },
  });

  currentDriver = driverObj;
  driverObj.drive();
};
