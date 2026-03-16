import { act, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("消息弹窗事件关闭动画", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("事件关闭时应先播放退出动画再移除弹窗", () => {
    vi.useFakeTimers();
    render(
      <AppContextProvider>
        <ClockPage />
      </AppContextProvider>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: {
            id: "weather:classEndForecast:test",
            type: "weatherForecast",
            title: "下课前天气预报",
            message: "测试内容",
          },
        })
      );
    });

    expect(screen.getByLabelText("下课前天气预报")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("messagePopup:close", {
          detail: {
            id: "weather:classEndForecast:test",
            dismiss: false,
          },
        })
      );
    });

    expect(screen.getByLabelText("下课前天气预报")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByLabelText("下课前天气预报")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByLabelText("下课前天气预报")).not.toBeInTheDocument();
  });
});
