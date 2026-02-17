import type { Config, Driver, DriveStep, State } from "driver.js";
import { describe, expect, it, vi, afterEach } from "vitest";

const createDriverMockImpl = (): Driver => ({
  isActive: () => false,
  drive: vi.fn(),
  refresh: vi.fn(),
  setConfig: vi.fn(),
  setSteps: vi.fn(),
  getConfig: vi.fn(),
  getState: vi.fn(),
  getActiveIndex: vi.fn(),
  isFirstStep: vi.fn(),
  isLastStep: vi.fn(),
  getActiveStep: vi.fn(),
  getActiveElement: vi.fn(),
  getPreviousElement: vi.fn(),
  getPreviousStep: vi.fn(),
  moveNext: vi.fn(),
  movePrevious: vi.fn(),
  moveTo: vi.fn(),
  hasNextStep: vi.fn(),
  hasPreviousStep: vi.fn(),
  highlight: vi.fn(),
  destroy: vi.fn(),
});

const driverMock = vi.fn<[Config?], Driver>(() => createDriverMockImpl());

vi.mock("driver.js", async () => {
  const actual = await vi.importActual<typeof import("driver.js")>("driver.js");
  return {
    ...actual,
    driver: driverMock,
  };
});

const createPopoverDom = () => {
  const wrapper = document.createElement("div");
  const arrow = document.createElement("div");
  const title = document.createElement("div");
  const description = document.createElement("div");
  const footer = document.createElement("div");
  const progress = document.createElement("div");
  const previousButton = document.createElement("button");
  const nextButton = document.createElement("button");
  const closeButton = document.createElement("button");
  const footerButtons = document.createElement("div");

  return {
    wrapper,
    arrow,
    title,
    description,
    footer,
    progress,
    previousButton,
    nextButton,
    closeButton,
    footerButtons,
  };
};

describe("tour 守卫式下一步", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("全局禁用键盘切步", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config | undefined;
    expect(config?.allowKeyboardControl).toBe(false);
  });

  it("完成最后一步时会派发 tour:completed 事件", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const completedListener = vi.fn();
    window.addEventListener("tour:completed", completedListener);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const driverInstance = driverMock.mock.results[0]?.value as Driver;

    const steps = Array.isArray(config.steps) ? config.steps : [];
    const lastStep = steps[steps.length - 1];

    // 模拟点击最后一步的完成按钮
    lastStep.popover!.onNextClick!(undefined, lastStep as DriveStep, {
      config,
      state: {} as State,
      driver: driverInstance,
    });

    // 模拟 destroy 触发 onDestroyed
    config.onDestroyed?.(undefined, lastStep as DriveStep, {
      config,
      state: {} as State,
      driver: driverInstance,
    });

    expect(driverInstance.destroy).toHaveBeenCalled();
    expect(completedListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("tour:completed", completedListener);
  });

  it("未完成最后一步结束时不会派发 tour:completed 事件", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const completedListener = vi.fn();
    window.addEventListener("tour:completed", completedListener);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const driverInstance = driverMock.mock.results[0]?.value as Driver;

    const steps = Array.isArray(config.steps) ? config.steps : [];
    const someStep = steps[2];

    // 直接调用 onDestroyed（模拟非完成状态下的销毁）
    config.onDestroyed?.(undefined, someStep as DriveStep, {
      config,
      state: { activeIndex: 2 } as State,
      driver: driverInstance,
    });

    expect(completedListener).toHaveBeenCalledTimes(0);

    window.removeEventListener("tour:completed", completedListener);
  });

  it("切换监测设置：未切换时点击下一步不会跳步，并触发辅助切换", async () => {
    vi.useFakeTimers();
    driverMock.mockClear();
    localStorage.clear();

    const monitorTab = document.createElement("button");
    monitorTab.id = "monitor";
    monitorTab.setAttribute("aria-selected", "false");
    monitorTab.addEventListener("click", () => {
      monitorTab.setAttribute("aria-selected", "true");
    });
    document.body.appendChild(monitorTab);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#monitor");
    expect(step?.popover?.onNextClick).toBeTypeOf("function");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(monitorTab.getAttribute("aria-selected")).toBe("true");
    expect(popoverDom.description.textContent).toContain("已为您执行切换操作");

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });

  it("噪音校准：未操作时不会跳步，并触发辅助点击校准按钮", async () => {
    vi.useFakeTimers();
    driverMock.mockClear();
    localStorage.clear();

    const calibrationWrapper = document.createElement("div");
    calibrationWrapper.setAttribute("data-tour", "noise-calibration");

    const status = document.createElement("div");
    status.setAttribute("data-tour", "noise-calibration-status");
    status.textContent = "未校准";
    calibrationWrapper.appendChild(status);

    const sliderWrapper = document.createElement("div");
    sliderWrapper.id = "tour-noise-baseline-slider";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.value = "45";
    sliderWrapper.appendChild(slider);
    calibrationWrapper.appendChild(sliderWrapper);

    const calibrateBtn = document.createElement("button");
    calibrateBtn.id = "tour-noise-calibrate-btn";
    const clickSpy = vi.spyOn(calibrateBtn, "click");
    calibrateBtn.addEventListener("click", () => {
      status.textContent = "已校准";
    });
    calibrationWrapper.appendChild(calibrateBtn);

    document.body.appendChild(calibrationWrapper);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === '[data-tour="noise-calibration"]');
    expect(step?.popover?.onNextClick).toBeTypeOf("function");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step?.onHighlightStarted?.(undefined as unknown as Element, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(popoverDom.description.textContent).toContain("已为您触发校准操作");

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });

  it("打开历史记录：未打开弹窗时不会跳步，并触发辅助点击入口", async () => {
    vi.useFakeTimers();
    driverMock.mockClear();
    localStorage.clear();

    const monitor = document.createElement("div");
    monitor.setAttribute("data-tour", "noise-monitor");

    const trigger = document.createElement("div");
    trigger.setAttribute("data-tour", "noise-history-trigger");
    trigger.addEventListener("click", () => {
      const modal = document.createElement("div");
      modal.setAttribute("data-tour", "noise-history-modal");
      document.body.appendChild(modal);
    });
    monitor.appendChild(trigger);
    document.body.appendChild(monitor);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === '[data-tour="noise-monitor"]');
    expect(step?.popover?.onNextClick).toBeTypeOf("function");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(document.querySelector('[data-tour="noise-history-modal"]')).toBeTruthy();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });

  it("退出历史界面：未关闭时不会跳步，并触发辅助点击关闭按钮", async () => {
    vi.useFakeTimers();
    driverMock.mockClear();
    localStorage.clear();

    const modal = document.createElement("div");
    modal.setAttribute("data-tour", "noise-history-modal");
    const closeBtn = document.createElement("button");
    closeBtn.setAttribute("data-tour", "noise-history-close");
    const clickSpy = vi.spyOn(closeBtn, "click");
    closeBtn.addEventListener("click", () => {
      modal.remove();
    });
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === '[data-tour="noise-history-close"]');
    expect(step?.popover?.onNextClick).toBeTypeOf("function");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-tour="noise-history-modal"]')).toBeFalsy();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });

  it("进入自习模式：未切换时点击下一步不会跳步，并触发辅助切换", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const switchMode = vi.fn();
    const { startTour } = await import("../tour");
    startTour(true, { switchMode });

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#mode-tab-study");
    expect(step?.popover?.onNextClick).toBeTypeOf("function");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(switchMode).toHaveBeenCalledWith("study");
    expect(popoverDom.description.textContent).toContain("已为您执行切换操作");
  });

  it("进入自习模式：切换成功后允许跳步", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true, { switchMode: vi.fn() });

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#mode-tab-study");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    const panel = document.createElement("div");
    panel.id = "study-panel";
    document.body.appendChild(panel);

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });

  it("进入自习模式：点击“帮我切换”成功后按钮文案改为“下一步”", async () => {
    vi.useFakeTimers();
    driverMock.mockClear();
    localStorage.clear();

    const tab = document.createElement("button");
    tab.id = "mode-tab-study";
    tab.addEventListener("click", () => {
      const panel = document.createElement("div");
      panel.id = "study-panel";
      document.body.appendChild(panel);
    });
    document.body.appendChild(tab);

    const { startTour } = await import("../tour");
    startTour(true, { switchMode: vi.fn() });

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#mode-tab-study");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();
    popoverDom.nextButton.innerHTML = "帮我切换";

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(document.getElementById("study-panel")).toBeTruthy();
    expect(popoverDom.description.textContent).toBeTruthy();
    expect(popoverDom.nextButton.innerHTML).toBe("下一步");
    expect(popoverDom.description.textContent).toContain("已为您执行切换操作");
  });

  it("打开设置：未打开时点击下一步不会跳步，并触发辅助打开", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const openSettings = vi.fn();
    const { startTour } = await import("../tour");
    startTour(true, { openSettings });

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#tour-settings-btn");

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(popoverDom.description.textContent).toContain("已为您执行打开操作");
  });

  it("保存设置：点击完成会先触发保存按钮点击再结束", async () => {
    vi.useFakeTimers();
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#settings-save-btn");

    const panel = document.createElement("div");
    panel.id = "settings-panel-container";
    document.body.appendChild(panel);

    const saveBtn = document.createElement("button");
    saveBtn.id = "settings-save-btn";
    const clickSpy = vi.spyOn(saveBtn, "click");
    saveBtn.addEventListener("click", () => {
      setTimeout(() => {
        panel.remove();
      }, 200);
    });
    document.body.appendChild(saveBtn);

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    driverInstance.isActive = () => true;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(undefined, step as DriveStep, {
      config,
      state: { popover: popoverDom } as State,
      driver: driverInstance,
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(driverInstance.moveNext).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(400);
    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });
});
