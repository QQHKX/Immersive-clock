/**
 * AppContext 单元测试
 * 测试全局状态管理的 Reducer 逻辑
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import { type AppAction, type AppState } from "../../types";
import { nowMs } from "../../utils/timeSource";
import { appReducer } from "../AppContext";

vi.mock("../../utils/timeSource");

describe("appReducer", () => {
  let state: AppState;

  beforeEach(() => {
    state = {
      mode: "clock",
      isHudVisible: false,
      countdown: {
        initialTime: 60,
        currentTime: 60,
        isActive: false,
      },
      stopwatch: {
        elapsedTime: 0,
        isActive: false,
      },
      study: {
        targetYear: 2026,
        countdownType: "gaokao",
        customName: "",
        customDate: "",
        display: {
          showStatusBar: true,
          showNoiseMonitor: true,
          showCountdown: true,
          showQuote: true,
          showTime: true,
          showDate: true,
        },
        countdownItems: [],
        carouselIntervalSec: 6,
        digitColor: "",
        digitOpacity: 1,
        numericFontFamily: "",
        textFontFamily: "",
        timeColor: "",
        dateColor: "",
        weatherAlertEnabled: true,
        minutelyPrecipEnabled: true,
      },
      quoteChannels: {
        channels: [],
        lastUpdated: 0,
      },
      quoteSettings: {
        autoRefreshInterval: 0,
      },
      announcement: {
        isVisible: false,
        activeTab: "announcement",
        dontShowAgain: false,
        lastShownTime: 0,
      },
      isModalOpen: false,
    };
    vi.mocked(nowMs).mockReturnValue(1000);
  });

  describe("模式切换", () => {
    it("SET_MODE 应该切换模式并隐藏 HUD", () => {
      const action: AppAction = { type: "SET_MODE", payload: "study" };
      const newState = appReducer(state, action);

      expect(newState.mode).toBe("study");
      expect(newState.isHudVisible).toBe(false);
    });
  });

  describe("HUD 控制", () => {
    it("TOGGLE_HUD 应该切换 HUD 可见性", () => {
      const action: AppAction = { type: "TOGGLE_HUD" };
      const newState = appReducer(state, action);

      expect(newState.isHudVisible).toBe(true);
    });

    it("SHOW_HUD 应该显示 HUD", () => {
      const action: AppAction = { type: "SHOW_HUD" };
      const newState = appReducer(state, action);

      expect(newState.isHudVisible).toBe(true);
    });

    it("HIDE_HUD 应该隐藏 HUD", () => {
      state.isHudVisible = true;
      const action: AppAction = { type: "HIDE_HUD" };
      const newState = appReducer(state, action);

      expect(newState.isHudVisible).toBe(false);
    });
  });

  describe("倒计时管理", () => {
    it("SET_COUNTDOWN 应该设置倒计时时间", () => {
      const action: AppAction = { type: "SET_COUNTDOWN", payload: 120 };
      const newState = appReducer(state, action);

      expect(newState.countdown.initialTime).toBe(120);
      expect(newState.countdown.currentTime).toBe(120);
      expect(newState.countdown.isActive).toBe(false);
      expect(newState.countdown.endTimestamp).toBeUndefined();
    });

    it("START_COUNTDOWN 应该激活倒计时并设置结束时间戳", () => {
      vi.mocked(nowMs).mockReturnValue(1000);
      const action: AppAction = { type: "START_COUNTDOWN" };
      const newState = appReducer(state, action);

      expect(newState.countdown.isActive).toBe(true);
      expect(newState.countdown.endTimestamp).toBe(61000);
    });

    it("PAUSE_COUNTDOWN 应该暂停并收敛剩余时间", () => {
      state.countdown.isActive = true;
      state.countdown.endTimestamp = 61000;
      vi.mocked(nowMs).mockReturnValue(35000);

      const action: AppAction = { type: "PAUSE_COUNTDOWN" };
      const newState = appReducer(state, action);

      expect(newState.countdown.isActive).toBe(false);
      expect(newState.countdown.currentTime).toBe(26);
      expect(newState.countdown.endTimestamp).toBeUndefined();
    });

    it("RESET_COUNTDOWN 应该重置到初始时间", () => {
      state.countdown.currentTime = 30;
      const action: AppAction = { type: "RESET_COUNTDOWN" };
      const newState = appReducer(state, action);

      expect(newState.countdown.currentTime).toBe(60);
      expect(newState.countdown.isActive).toBe(false);
      expect(newState.countdown.endTimestamp).toBeUndefined();
    });

    it("FINISH_COUNTDOWN 应该结束倒计时", () => {
      const action: AppAction = { type: "FINISH_COUNTDOWN" };
      const newState = appReducer(state, action);

      expect(newState.countdown.currentTime).toBe(0);
      expect(newState.countdown.isActive).toBe(false);
    });
  });

  describe("秒表管理", () => {
    it("START_STOPWATCH 应该激活秒表", () => {
      const action: AppAction = { type: "START_STOPWATCH" };
      const newState = appReducer(state, action);

      expect(newState.stopwatch.isActive).toBe(true);
    });

    it("PAUSE_STOPWATCH 应该暂停秒表", () => {
      state.stopwatch.isActive = true;
      const action: AppAction = { type: "PAUSE_STOPWATCH" };
      const newState = appReducer(state, action);

      expect(newState.stopwatch.isActive).toBe(false);
    });

    it("RESET_STOPWATCH 应该重置秒表", () => {
      state.stopwatch.elapsedTime = 5000;
      state.stopwatch.isActive = true;
      const action: AppAction = { type: "RESET_STOPWATCH" };
      const newState = appReducer(state, action);

      expect(newState.stopwatch.elapsedTime).toBe(0);
      expect(newState.stopwatch.isActive).toBe(false);
    });

    it("TICK_STOPWATCH 应该增加经过时间", () => {
      const action: AppAction = { type: "TICK_STOPWATCH" };
      const newState = appReducer(state, action);

      expect(newState.stopwatch.elapsedTime).toBe(10);
    });

    it("TICK_STOPWATCH_BY 应该增加指定次数的经过时间", () => {
      const action: AppAction = { type: "TICK_STOPWATCH_BY", payload: 5 };
      const newState = appReducer(state, action);

      expect(newState.stopwatch.elapsedTime).toBe(50);
    });
  });

  describe("模态框管理", () => {
    it("OPEN_MODAL 应该打开模态框", () => {
      const action: AppAction = { type: "OPEN_MODAL" };
      const newState = appReducer(state, action);

      expect(newState.isModalOpen).toBe(true);
    });

    it("CLOSE_MODAL 应该关闭模态框", () => {
      state.isModalOpen = true;
      const action: AppAction = { type: "CLOSE_MODAL" };
      const newState = appReducer(state, action);

      expect(newState.isModalOpen).toBe(false);
    });
  });
});
