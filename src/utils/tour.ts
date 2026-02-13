import { driver, type Driver, type DriverHook, type PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";
import "../styles/tour.css";

const TOUR_STORAGE_KEY = "immersive-clock:has-seen-tour";

let currentDriver: Driver | null = null;
let calibrationAttemptedInTour = false;
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
 * 判断“噪音监测”是否已开启（作为历史记录入口前置条件）
 */
const isNoiseMonitorEnabled = () => {
  const input = document.getElementById("tour-noise-monitor-checkbox") as HTMLInputElement | null;
  if (!input) return false;
  return !!input.checked;
};

/**
 * 判断噪音历史记录弹窗是否已打开
 */
const isNoiseHistoryModalOpen = () => {
  const modal = document.querySelector('[data-tour="noise-history-modal"]');
  return !!modal && (typeof (modal as HTMLElement).isConnected !== "boolean" || (modal as HTMLElement).isConnected);
};

/**
 * 等待条件成立后再进入下一步（用于跨 React 状态切换后的稳定过渡）
 */
const waitForConditionThenMoveNext = (params: {
  driverObj: Driver;
  condition: () => boolean;
  timeoutMs?: number;
  intervalMs?: number;
}) => {
  const { driverObj, condition, timeoutMs = 2400, intervalMs = 60 } = params;
  const startedAt = Date.now();
  const tick = () => {
    if (!driverObj.isActive()) return;
    if (condition()) {
      driverObj.moveNext();
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

  calibrationAttemptedInTour = false;
  calibrationBaselineAtEnter = null;

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
        element: "#monitor",
        popover: {
          title: "监测设置",
          description:
            "这里可以配置噪音监测、阈值、校准与报告等。点击“帮我切换”可自动打开“监测设置”。",
          side: "bottom",
          align: "center",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isSettingsCategoryActive("monitor") ? "下一步" : "帮我切换");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: () => isSettingsCategoryActive("monitor"),
            attemptResolve: () => {
              tryClickElement("#monitor");
            },
            hintAfterAttempt:
              "已为您执行切换操作；若未切换到“监测设置”，请手动点击顶部的“监测设置”标签后再继续。",
          }),
        },
      },
      {
        element: '[data-tour="noise-calibration"]',
        popover: {
          title: "校准噪音值",
          description:
            "建议在安静环境下点击“开始校准”（需要麦克风权限）；若仅显示偏差，也可拖动“基准噪音值”滑块进行手动修正。完成任意一种操作后再继续。",
          side: "top",
          align: "center",
          onPopoverRender: (popover) => {
            const baselineValue = getNoiseBaselineSliderValue();
            const baselineChanged =
              baselineValue !== null &&
              calibrationBaselineAtEnter !== null &&
              Math.abs(baselineValue - calibrationBaselineAtEnter) >= 0.5;
            const satisfied = isNoiseCalibrated() || calibrationAttemptedInTour || baselineChanged;
            setNextButtonText(popover, satisfied ? "下一步" : "帮我开始校准");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: () => {
              const baselineValue = getNoiseBaselineSliderValue();
              const baselineChanged =
                baselineValue !== null &&
                calibrationBaselineAtEnter !== null &&
                Math.abs(baselineValue - calibrationBaselineAtEnter) >= 0.5;
              return isNoiseCalibrated() || calibrationAttemptedInTour || baselineChanged;
            },
            attemptResolve: () => {
              calibrationAttemptedInTour = true;
              tryClickElement("#tour-noise-calibrate-btn");
            },
            hintAfterAttempt:
              "已为您触发校准操作；如弹出确认/权限提示，请按提示允许麦克风。若不便授权，也可拖动滑块完成手动修正后继续。",
          }),
        },
        onHighlightStarted: () => {
          const baselineValue = getNoiseBaselineSliderValue();
          calibrationBaselineAtEnter = baselineValue;
          const el = document.querySelector('[data-tour="noise-calibration"]') as HTMLElement | null;
          el?.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" });
        },
      },
      {
        element: "#basic",
        popover: {
          title: "基础设置",
          description: "接下来开启历史记录入口：请切回“基础设置”。点击“帮我切换”可自动切换。",
          side: "bottom",
          align: "center",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isSettingsCategoryActive("basic") ? "下一步" : "帮我切换");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: () => isSettingsCategoryActive("basic"),
            attemptResolve: () => {
              tryClickElement("#basic");
            },
            hintAfterAttempt:
              "已为您执行切换操作；若未切换到“基础设置”，请手动点击顶部的“基础设置”标签后再继续。",
          }),
        },
      },
      {
        element: "#tour-noise-monitor-checkbox",
        popover: {
          title: "开启历史记录入口",
          description:
            "请勾选“噪音监测”。开启后，自习页面左上角会出现噪音监测组件，点击即可打开历史记录管理。",
          side: "top",
          align: "end",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isNoiseMonitorEnabled() ? "下一步" : "帮我打开");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: isNoiseMonitorEnabled,
            attemptResolve: () => {
              tryClickElement("#tour-noise-monitor-checkbox");
            },
            hintAfterAttempt:
              "已为您执行勾选操作；若未勾选成功，请手动点击“噪音监测”复选框后再继续。",
          }),
        },
      },
      {
        element: "#settings-save-btn",
        popover: {
          title: "保存设置",
          description: "点击“帮我保存”会自动保存设置并返回自习页面，然后继续教您打开历史记录。",
          side: "top",
          align: "end",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, "帮我保存");
          },
          onNextClick: (_el, _step, opts) => {
            tryClickElement("#settings-save-btn");
            waitForConditionThenMoveNext({
              driverObj: opts.driver,
              condition: () => !isSettingsPanelOpen(),
            });
            scheduleDriverRefresh(opts.driver, 120);
          },
        },
      },
      {
        element: '[data-tour="noise-monitor"]',
        popover: {
          title: "打开历史记录",
          description:
            "点击噪音监测左侧的小灯或状态文字即可打开“历史记录管理”。点击“帮我打开”可自动帮您点击入口。",
          side: "right",
          align: "center",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isNoiseHistoryModalOpen() ? "下一步" : "帮我打开");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: isNoiseHistoryModalOpen,
            attemptResolve: () => {
              const clicked = tryClickElement('[data-tour="noise-history-trigger"]');
              if (!clicked) {
                tryClickElement('[data-tour="noise-monitor"]');
              }
            },
            hintAfterAttempt:
              "已为您执行打开操作；若弹窗未出现，请手动点击噪音监测的小灯或状态文字后再继续。",
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
            "这里可以查看最近24小时的噪音历史，或自定义时间段生成报告。接下来我会带您正确退出历史界面。",
          side: "left",
          align: "center",
        },
      },
      {
        element: '[data-tour="noise-history-modal"] [data-tour="noise-history-footer-close"]',
        popover: {
          title: "退出历史界面",
          description:
            "点击下方“关闭”按钮即可返回自习页面。点击“帮我关闭”可自动帮您点击；关闭成功后按钮会变为“下一步”。",
          side: "left",
          align: "end",
          onPopoverRender: (popover) => {
            setNextButtonText(popover, isNoiseHistoryModalOpen() ? "帮我关闭" : "下一步");
          },
          onNextClick: createGuardedNextClick({
            isSatisfied: () => !isNoiseHistoryModalOpen(),
            attemptResolve: () => {
              tryClickElement(
                '[data-tour="noise-history-modal"] [data-tour="noise-history-footer-close"]'
              );
            },
            hintAfterAttempt: "已为您执行关闭操作；若未关闭，请手动点击下方“关闭”按钮后再继续。",
          }),
        },
      },
      {
        popover: {
          title: "完成新手指引",
          description: "您已完成噪音校准与历史记录的关键操作。点击“完成”结束指引并播放结束动画。",
          side: "left",
          align: "center",
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
