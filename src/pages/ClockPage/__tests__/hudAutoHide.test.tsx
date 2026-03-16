import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";

import { AppContextProvider } from "../../../contexts/AppContext";
import { ClockPage } from "../ClockPage";

vi.mock("../../../utils/timeSync", () => ({
  startTimeSyncManager: () => () => {},
}));

vi.mock("../../../utils/tour", () => ({
  startTour: () => {},
  isTourActive: () => false,
}));

vi.mock("../../../components/AnnouncementModal", () => ({
  default: () => null,
}));

vi.mock("../../../components/AuthorInfo/AuthorInfo", () => ({
  AuthorInfo: () => null,
}));

vi.mock("../../../components/SettingsButton", () => ({
  SettingsButton: () => null,
}));

vi.mock("../../../components/SettingsPanel", () => ({
  SettingsPanel: () => null,
}));

vi.mock("../../../components/CountdownModal/CountdownModal", () => ({
  CountdownModal: () => null,
}));

vi.mock("../../../components/Clock/Clock", () => ({
  Clock: () => <div>clock</div>,
}));

vi.mock("../../../components/Countdown/Countdown", () => ({
  Countdown: () => <div>countdown</div>,
}));

vi.mock("../../../components/Stopwatch/Stopwatch", () => ({
  Stopwatch: () => <div>stopwatch</div>,
}));

vi.mock("../../../components/Study/Study", () => ({
  Study: () => <div>study</div>,
}));

vi.mock("../../../components/ModeSelector/ModeSelector", () => ({
  ModeSelector: () => <button type="button">HUD-模式</button>,
}));

vi.mock("../../../components/ControlBar/ControlBar", () => ({
  ControlBar: () => <button type="button">HUD-控制</button>,
}));

describe("HUD 自动隐藏", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("当焦点在 HUD 内时，不应被 8 秒定时器隐藏", () => {
    vi.useFakeTimers();

    render(
      <AppContextProvider>
        <ClockPage />
      </AppContextProvider>
    );

    const main = screen.getByLabelText("时钟应用主界面");
    const timeDisplay = screen.getByRole("tabpanel");

    fireEvent.click(timeDisplay);

    const hud = screen.getByLabelText("HUD 控制面板");
    expect(hud).toHaveAttribute("aria-hidden", "false");

    const hudButton = screen.getByRole("button", { name: "HUD-模式" });
    fireEvent.focusIn(hudButton);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(hud).toHaveAttribute("aria-hidden", "false");

    fireEvent.focusOut(hudButton, { relatedTarget: main });
    fireEvent.focusIn(main);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(hud).toHaveAttribute("aria-hidden", "true");
  });
});
