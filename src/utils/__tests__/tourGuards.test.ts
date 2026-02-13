import type { Config, Driver } from "driver.js";
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

    const lastStep = config.steps?.[config.steps.length - 1];
    driverInstance.getConfig = () => config;
    driverInstance.getState = () => ({ activeIndex: config.steps.length - 1 } as any);

    config.onDestroyed?.(undefined, lastStep as any, { config, state: { activeIndex: config.steps.length - 1 }, driver: driverInstance } as any);

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

    const someStep = config.steps?.[2];
    driverInstance.getConfig = () => config;
    driverInstance.getState = () => ({ activeIndex: 2 } as any);

    config.onDestroyed?.(undefined, someStep as any, { config, state: { activeIndex: 2 }, driver: driverInstance } as any);

    expect(completedListener).toHaveBeenCalledTimes(0);

    window.removeEventListener("tour:completed", completedListener);
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

    step!.popover!.onNextClick!(
      undefined,
      step as any,
      { config, state: { popover: popoverDom }, driver: driverInstance } as any
    );

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

    step!.popover!.onNextClick!(
      undefined,
      step as any,
      { config, state: { popover: popoverDom }, driver: driverInstance } as any
    );

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

    step!.popover!.onNextClick!(
      undefined,
      step as any,
      { config, state: { popover: popoverDom }, driver: driverInstance } as any
    );

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

    step!.popover!.onNextClick!(
      undefined,
      step as any,
      { config, state: { popover: popoverDom }, driver: driverInstance } as any
    );

    expect(driverInstance.moveNext).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(popoverDom.description.textContent).toContain("已为您执行打开操作");
  });

  it("保存设置：点击完成会先触发保存按钮点击再结束", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const step = config.steps?.find((s) => s.element === "#settings-save-btn");

    const saveBtn = document.createElement("button");
    saveBtn.id = "settings-save-btn";
    const clickSpy = vi.spyOn(saveBtn, "click");
    document.body.appendChild(saveBtn);

    const driverInstance = driverMock.mock.results[0]?.value as Driver;
    const popoverDom = createPopoverDom();

    step!.popover!.onNextClick!(
      undefined,
      step as any,
      { config, state: { popover: popoverDom }, driver: driverInstance } as any
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });
});
