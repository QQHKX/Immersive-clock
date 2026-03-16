import React, { createContext, useContext, useReducer, ReactNode } from "react";

import { STOPWATCH_TICK_MS } from "../constants/timer";
import { AppState, AppAction, StudyState, QuoteChannelState, QuoteSettingsState } from "../types";
import { getAppSettings, updateAppSettings, updateStudySettings } from "../utils/appSettings";
import { setErrorCenterMode } from "../utils/errorCenter";
import { getStartupModeFromSettings } from "../utils/startupMode";
import { nowMs } from "../utils/timeSource";

/**
 * 从本地存储加载语录设置状态
 */
function loadQuoteSettingsState(): QuoteSettingsState {
  const settings = getAppSettings();
  return {
    autoRefreshInterval: settings.general.quote.autoRefreshInterval,
  };
}

/**
 * 从本地存储加载语录渠道配置
 */
function loadQuoteChannelState(): QuoteChannelState {
  const settings = getAppSettings();
  return {
    channels: settings.general.quote.channels,
    lastUpdated: settings.general.quote.lastUpdated,
  };
}

/**
 * 从本地存储加载自习状态
 */
function loadStudyState(): StudyState {
  const settings = getAppSettings();
  const study = settings.study;

  return {
    targetYear: study.targetYear,
    countdownType: study.countdownType,
    customName: study.customCountdown.name,
    customDate: study.customCountdown.date,
    display: study.display,
    countdownItems: study.countdownItems,
    carouselIntervalSec: study.carouselIntervalSec,
    digitColor: study.style.digitColor,
    digitOpacity: study.style.digitOpacity,
    numericFontFamily: study.style.numericFontFamily,
    textFontFamily: study.style.textFontFamily,
    timeColor: study.style.timeColor,
    dateColor: study.style.dateColor,
    weatherAlertEnabled: study.alerts.weatherAlert,
    minutelyPrecipEnabled: study.alerts.minutelyPrecip,
    errorPopupEnabled: study.alerts.errorPopup,
    errorCenterMode: study.alerts.errorCenterMode,
    airQualityAlertEnabled: study.alerts.airQuality,
    sunriseSunsetAlertEnabled: study.alerts.sunriseSunset,
    classEndForecastEnabled: study.alerts.classEndForecast,
  };
}

/**
 * 应用初始状态
 */
const initialState: AppState = {
  mode: getStartupModeFromSettings(),
  isHudVisible: false,
  countdown: {
    initialTime: 0,
    currentTime: 0,
    isActive: false,
  },
  stopwatch: {
    elapsedTime: 0,
    isActive: false,
  },
  study: loadStudyState(),
  quoteChannels: loadQuoteChannelState(),
  quoteSettings: loadQuoteSettingsState(),
  announcement: {
    isVisible: false,
    activeTab: "announcement",
    dontShowAgain: false,
    lastShownTime: 0,
  },
  isModalOpen: false,
};

/**
 * 导出用于测试的默认状态
 */
export const getInitialState = (): AppState => initialState;

/**
 * 应用状态减速器
 * @param state 当前状态
 * @param action 动作
 * @returns 新状态
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
        // 切换模式时隐藏HUD
        isHudVisible: false,
      };

    case "TOGGLE_HUD":
      return {
        ...state,
        isHudVisible: !state.isHudVisible,
      };

    case "SHOW_HUD":
      return {
        ...state,
        isHudVisible: true,
      };

    case "HIDE_HUD":
      return {
        ...state,
        isHudVisible: false,
      };

    case "SET_COUNTDOWN":
      return {
        ...state,
        countdown: {
          ...state.countdown,
          initialTime: action.payload,
          currentTime: action.payload,
          isActive: false,
          endTimestamp: undefined,
        },
      };

    case "START_COUNTDOWN":
      return {
        ...state,
        countdown: {
          ...state.countdown,
          isActive: true,
          endTimestamp: nowMs() + state.countdown.currentTime * 1000,
        },
      };

    case "PAUSE_COUNTDOWN":
      // 暂停时根据结束时间戳收敛一次剩余时间，并清除结束时间戳
      const remaining = state.countdown.endTimestamp
        ? Math.max(0, Math.ceil((state.countdown.endTimestamp - nowMs()) / 1000))
        : state.countdown.currentTime;
      return {
        ...state,
        countdown: {
          ...state.countdown,
          currentTime: remaining,
          isActive: false,
          endTimestamp: undefined,
        },
      };

    case "RESET_COUNTDOWN":
      return {
        ...state,
        countdown: {
          ...state.countdown,
          currentTime: state.countdown.initialTime,
          isActive: false,
          endTimestamp: undefined,
        },
      };

    // 删除 TICK_COUNTDOWN 分支（组件级局部刷新已接管）

    case "START_STOPWATCH":
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          isActive: true,
        },
      };

    case "PAUSE_STOPWATCH":
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          isActive: false,
        },
      };

    case "RESET_STOPWATCH":
      return {
        ...state,
        stopwatch: {
          elapsedTime: 0,
          isActive: false,
        },
      };

    case "TICK_STOPWATCH":
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          elapsedTime: state.stopwatch.elapsedTime + STOPWATCH_TICK_MS,
        },
      };

    case "TICK_STOPWATCH_BY":
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          elapsedTime: state.stopwatch.elapsedTime + action.payload * STOPWATCH_TICK_MS,
        },
      };

    case "FINISH_COUNTDOWN":
      return {
        ...state,
        countdown: {
          ...state.countdown,
          currentTime: 0,
          isActive: false,
          endTimestamp: undefined,
        },
      };

    case "OPEN_MODAL":
      return {
        ...state,
        isModalOpen: true,
      };

    case "CLOSE_MODAL":
      return {
        ...state,
        isModalOpen: false,
      };

    case "SET_TARGET_YEAR":
      const newStudyState = {
        ...state.study,
        targetYear: action.payload,
      };
      // 保存到本地存储
      updateStudySettings({ targetYear: action.payload });
      return {
        ...state,
        study: newStudyState,
      };

    case "SET_COUNTDOWN_TYPE":
      const typeUpdatedStudy = {
        ...state.study,
        countdownType: action.payload,
      };
      updateStudySettings({ countdownType: action.payload });
      return {
        ...state,
        study: typeUpdatedStudy,
      };

    case "SET_CUSTOM_COUNTDOWN":
      const customUpdatedStudy = {
        ...state.study,
        customName: action.payload.name,
        customDate: action.payload.date,
      };
      updateStudySettings({ customCountdown: action.payload });
      return {
        ...state,
        study: customUpdatedStudy,
      };

    case "SET_STUDY_DISPLAY":
      const displayUpdatedStudy = {
        ...state.study,
        display: {
          ...(state.study.display || {}),
          ...action.payload,
        },
      };
      updateStudySettings({ display: displayUpdatedStudy.display });
      return {
        ...state,
        study: displayUpdatedStudy,
      };

    case "SET_COUNTDOWN_ITEMS":
      const itemsUpdatedStudy = {
        ...state.study,
        countdownItems: action.payload,
      };
      updateStudySettings({ countdownItems: action.payload });
      return {
        ...state,
        study: itemsUpdatedStudy,
      };

    case "SET_CAROUSEL_INTERVAL":
      const intervalUpdatedStudy = {
        ...state.study,
        carouselIntervalSec: action.payload,
      };
      updateStudySettings({ carouselIntervalSec: action.payload });
      return {
        ...state,
        study: intervalUpdatedStudy,
      };

    case "SET_COUNTDOWN_DIGIT_COLOR":
      const digitColorUpdatedStudy = {
        ...state.study,
        digitColor: action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          style: {
            ...current.study.style,
            digitColor: action.payload,
          },
        },
      }));
      return {
        ...state,
        study: digitColorUpdatedStudy,
      };

    case "SET_COUNTDOWN_DIGIT_OPACITY":
      const digitOpacityUpdatedStudy = {
        ...state.study,
        digitOpacity:
          typeof action.payload === "number" ? Math.max(0, Math.min(1, action.payload)) : 1,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          style: {
            ...current.study.style,
            digitOpacity: digitOpacityUpdatedStudy.digitOpacity,
          },
        },
      }));
      return {
        ...state,
        study: digitOpacityUpdatedStudy,
      };

    case "SET_STUDY_NUMERIC_FONT":
      const numericFontUpdatedStudy = {
        ...state.study,
        numericFontFamily: action.payload || undefined,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          style: {
            ...current.study.style,
            numericFontFamily: action.payload || undefined,
          },
        },
      }));
      return {
        ...state,
        study: numericFontUpdatedStudy,
      };

    case "SET_STUDY_TEXT_FONT":
      const textFontUpdatedStudy = {
        ...state.study,
        textFontFamily: action.payload || undefined,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          style: {
            ...current.study.style,
            textFontFamily: action.payload || undefined,
          },
        },
      }));
      return {
        ...state,
        study: textFontUpdatedStudy,
      };

    case "SET_STUDY_TIME_COLOR":
      const timeColorUpdatedStudy = {
        ...state.study,
        timeColor: action.payload || undefined,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          style: {
            ...current.study.style,
            timeColor: action.payload || undefined,
          },
        },
      }));
      return {
        ...state,
        study: timeColorUpdatedStudy,
      };

    case "SET_STUDY_DATE_COLOR":
      const dateColorUpdatedStudy = {
        ...state.study,
        dateColor: action.payload || undefined,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          style: {
            ...current.study.style,
            dateColor: action.payload || undefined,
          },
        },
      }));
      return {
        ...state,
        study: dateColorUpdatedStudy,
      };

    case "SET_WEATHER_ALERT_ENABLED":
      const alertUpdatedStudy = {
        ...state.study,
        weatherAlertEnabled: !!action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            weatherAlert: !!action.payload,
          },
        },
      }));
      return {
        ...state,
        study: alertUpdatedStudy,
      };

    case "SET_MINUTELY_PRECIP_ENABLED":
      const precipUpdatedStudy = {
        ...state.study,
        minutelyPrecipEnabled: !!action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            minutelyPrecip: !!action.payload,
          },
        },
      }));
      return {
        ...state,
        study: precipUpdatedStudy,
      };

    case "SET_ERROR_POPUP_ENABLED":
      const errorPopupUpdatedStudy = {
        ...state.study,
        errorPopupEnabled: !!action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            errorPopup: !!action.payload,
          },
        },
      }));
      return {
        ...state,
        study: errorPopupUpdatedStudy,
      };

    case "SET_ERROR_CENTER_MODE":
      const errorCenterUpdatedStudy = {
        ...state.study,
        errorCenterMode: action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            errorCenterMode: action.payload,
          },
        },
      }));
      setErrorCenterMode(action.payload);
      return {
        ...state,
        study: errorCenterUpdatedStudy,
      };

    case "SET_AIR_QUALITY_ALERT_ENABLED":
      const airQualityUpdatedStudy = {
        ...state.study,
        airQualityAlertEnabled: !!action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            airQuality: !!action.payload,
          },
        },
      }));
      return {
        ...state,
        study: airQualityUpdatedStudy,
      };

    case "SET_SUNRISE_SUNSET_ALERT_ENABLED":
      const sunriseSunsetUpdatedStudy = {
        ...state.study,
        sunriseSunsetAlertEnabled: !!action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            sunriseSunset: !!action.payload,
          },
        },
      }));
      return {
        ...state,
        study: sunriseSunsetUpdatedStudy,
      };

    case "SET_CLASS_END_FORECAST_ENABLED":
      const classEndForecastUpdatedStudy = {
        ...state.study,
        classEndForecastEnabled: !!action.payload,
      };
      updateAppSettings((current) => ({
        study: {
          ...current.study,
          alerts: {
            ...current.study.alerts,
            classEndForecast: !!action.payload,
          },
        },
      }));
      return {
        ...state,
        study: classEndForecastUpdatedStudy,
      };

    case "UPDATE_QUOTE_CHANNELS":
      const newQuoteChannelState = {
        channels: action.payload,
        lastUpdated: Date.now(),
      };
      // 保存到本地存储
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            channels: action.payload,
            lastUpdated: Date.now(),
          },
        },
      }));
      return {
        ...state,
        quoteChannels: newQuoteChannelState,
      };

    case "TOGGLE_QUOTE_CHANNEL":
      const updatedChannels = state.quoteChannels.channels.map((channel) =>
        channel.id === action.payload ? { ...channel, enabled: !channel.enabled } : channel
      );
      const toggledChannelState = {
        channels: updatedChannels,
        lastUpdated: Date.now(),
      };
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            channels: updatedChannels,
            lastUpdated: Date.now(),
          },
        },
      }));
      return {
        ...state,
        quoteChannels: toggledChannelState,
      };

    case "UPDATE_QUOTE_CHANNEL_WEIGHT":
      const weightUpdatedChannels = state.quoteChannels.channels.map((channel) =>
        channel.id === action.payload.id ? { ...channel, weight: action.payload.weight } : channel
      );
      const weightUpdatedState = {
        channels: weightUpdatedChannels,
        lastUpdated: Date.now(),
      };
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            channels: weightUpdatedChannels,
            lastUpdated: Date.now(),
          },
        },
      }));
      return {
        ...state,
        quoteChannels: weightUpdatedState,
      };

    case "UPDATE_QUOTE_CHANNEL_CATEGORIES":
      const categoriesUpdatedChannels = state.quoteChannels.channels.map((channel) =>
        channel.id === action.payload.id
          ? { ...channel, hitokotoCategories: action.payload.categories }
          : channel
      );
      const categoriesUpdatedState = {
        channels: categoriesUpdatedChannels,
        lastUpdated: Date.now(),
      };
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            channels: categoriesUpdatedChannels,
            lastUpdated: Date.now(),
          },
        },
      }));
      return {
        ...state,
        quoteChannels: categoriesUpdatedState,
      };

    case "UPDATE_QUOTE_CHANNEL_ORDER_MODE":
      const orderModeUpdatedChannels = state.quoteChannels.channels.map((channel) =>
        channel.id === action.payload.id
          ? { ...channel, orderMode: action.payload.orderMode }
          : channel
      );
      const orderModeUpdatedState = {
        channels: orderModeUpdatedChannels,
        lastUpdated: Date.now(),
      };
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            channels: orderModeUpdatedChannels,
            lastUpdated: Date.now(),
          },
        },
      }));
      return {
        ...state,
        quoteChannels: orderModeUpdatedState,
      };

    case "UPDATE_QUOTE_CHANNEL_INDEX":
      const indexUpdatedChannels = state.quoteChannels.channels.map((channel) =>
        channel.id === action.payload.id
          ? { ...channel, currentQuoteIndex: action.payload.index }
          : channel
      );
      const indexUpdatedState = {
        channels: indexUpdatedChannels,
        lastUpdated: Date.now(),
      };
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            channels: indexUpdatedChannels,
            lastUpdated: Date.now(),
          },
        },
      }));
      return {
        ...state,
        quoteChannels: indexUpdatedState,
      };

    case "SET_QUOTE_AUTO_REFRESH_INTERVAL":
      const newQuoteSettings = {
        ...state.quoteSettings,
        autoRefreshInterval: action.payload,
      };
      // 保存到本地存储
      updateAppSettings((current) => ({
        general: {
          ...current.general,
          quote: {
            ...current.general.quote,
            autoRefreshInterval: action.payload,
          },
        },
      }));
      return {
        ...state,
        quoteSettings: newQuoteSettings,
      };

    default:
      return state;
  }
}

/**
 * 应用状态上下文
 */
const AppStateContext = createContext<AppState | undefined>(undefined);

/**
 * 应用分发上下文
 */
const AppDispatchContext = createContext<React.Dispatch<AppAction> | undefined>(undefined);

/**
 * 应用上下文提供者属性接口
 */
interface AppContextProviderProps {
  children: ReactNode;
}

/**
 * 应用上下文提供者组件
 * @param children 子组件
 */
export function AppContextProvider({ children }: AppContextProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

/**
 * 使用应用状态钩子
 * @returns 应用状态
 */
export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppContextProvider");
  }
  return context;
}

/**
 * 使用应用分发钩子
 * @returns 分发函数
 */
export function useAppDispatch(): React.Dispatch<AppAction> {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error("useAppDispatch must be used within an AppContextProvider");
  }
  return context;
}

/**
 * 使用应用上下文钩子（同时获取状态和分发函数）
 * @returns [state, dispatch] 状态和分发函数
 */
export function useAppContext(): [AppState, React.Dispatch<AppAction>] {
  return [useAppState(), useAppDispatch()];
}

/**
 * 导出 Reducer 以便测试使用
 */
export { appReducer };
