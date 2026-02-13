import type { Config, Driver } from "driver.js";
import { describe, expect, it, vi } from "vitest";

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

const createUsableButton = () => {
  const button = document.createElement("button");
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 10,
    right: 10,
    width: 10,
    height: 10,
    toJSON: () => ({}),
  } as DOMRect);
  return button;
};

describe("tour 默认焦点", () => {
  it("默认把焦点目标导向“下一步”，避免落在“上一步/X”", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true);

    expect(driverMock).toHaveBeenCalledTimes(1);
    const config = driverMock.mock.calls[0]?.[0] as Config | undefined;
    expect(config?.onPopoverRender).toBeTypeOf("function");

    const nextButton = createUsableButton();
    const previousButton = createUsableButton();
    const closeButton = createUsableButton();

    config!.onPopoverRender!(
      {
        nextButton,
        previousButton,
        closeButton,
      } as any,
      { config: config!, state: {}, driver: createDriverMockImpl() } as any
    );

    expect(closeButton.disabled).toBe(true);
    expect(previousButton.disabled).toBe(true);

    await Promise.resolve();

    expect(closeButton.disabled).toBe(false);
    expect(previousButton.disabled).toBe(false);
  });

  it("当“下一步”不可用时，优先避免默认落在“X”", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config | undefined;

    const nextButton = createUsableButton();
    nextButton.disabled = true;
    const previousButton = createUsableButton();
    const closeButton = createUsableButton();

    config!.onPopoverRender!(
      {
        nextButton,
        previousButton,
        closeButton,
      } as any,
      { config: config!, state: {}, driver: createDriverMockImpl() } as any
    );

    expect(closeButton.disabled).toBe(true);
    expect(previousButton.disabled).toBe(false);

    await Promise.resolve();

    expect(closeButton.disabled).toBe(false);
    expect(previousButton.disabled).toBe(false);
  });
});
