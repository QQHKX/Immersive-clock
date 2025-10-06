import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppState, AppAction, AppMode, StudyState, QuoteChannelState, QuoteSourceConfig, QuoteSettingsState } from '../types';
import { nowMs } from '../utils/timeSource';
import { STOPWATCH_TICK_MS } from '../constants/timer';

/**
 * 从本地存储加载金句设置状态
 */
function loadQuoteSettingsState(): QuoteSettingsState {
  try {
    const savedInterval = localStorage.getItem('quote-auto-refresh-interval');
    if (savedInterval) {
      const interval = parseInt(savedInterval, 10);
      return {
        autoRefreshInterval: isNaN(interval) ? 600 : interval // 默认10分钟
      };
    }
  } catch (error) {
    console.warn('Failed to load quote settings from localStorage:', error);
  }
  
  return {
    autoRefreshInterval: 600 // 默认10分钟
  };
}

/**
 * 从本地存储加载金句渠道配置
 */
function loadQuoteChannelState(): QuoteChannelState {
  try {
    const savedChannels = localStorage.getItem('quote-channels');
    if (savedChannels) {
      const parsed = JSON.parse(savedChannels);
      return {
        channels: parsed.channels || [],
        lastUpdated: parsed.lastUpdated || Date.now()
      };
    }
  } catch (error) {
    console.warn('Failed to load quote channels from localStorage:', error);
  }
  
  // 返回默认配置，从文件中加载
  return {
    channels: [],
    lastUpdated: Date.now()
  };
}


/**
 * 从本地存储加载晚自习状态
 */
function loadStudyState(): StudyState {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const thisYearGaokao = new Date(currentYear, 5, 7); // 月份从0开始，6月为5
    const nearestGaokaoYear = now > thisYearGaokao ? currentYear + 1 : currentYear;

    const savedTargetYear = localStorage.getItem('study-target-year');
    const savedCountdownType = localStorage.getItem('countdown-type') as 'gaokao' | 'custom' | null;
    const savedCustomName = localStorage.getItem('custom-countdown-name');
    const savedCustomDate = localStorage.getItem('custom-countdown-date');

    const targetYear = savedTargetYear ? parseInt(savedTargetYear, 10) : nearestGaokaoYear;

    return {
      targetYear,
      countdownType: savedCountdownType ?? 'gaokao',
      customName: savedCustomName ?? '',
      customDate: savedCustomDate ?? ''
    };
  } catch (error) {
    console.warn('Failed to load study state from localStorage:', error);
    const now = new Date();
    const currentYear = now.getFullYear();
    const thisYearGaokao = new Date(currentYear, 5, 7);
    const nearestGaokaoYear = now > thisYearGaokao ? currentYear + 1 : currentYear;
    return {
      targetYear: nearestGaokaoYear,
      countdownType: 'gaokao',
      customName: '',
      customDate: ''
    };
  }
}

/**
 * 应用初始状态
 */
const initialState: AppState = {
  mode: 'clock',
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
    activeTab: 'announcement',
    dontShowAgain: false,
    lastShownTime: 0
  },
  isModalOpen: false,
};

/**
 * 应用状态减速器
 * @param state 当前状态
 * @param action 动作
 * @returns 新状态
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        // 切换模式时隐藏HUD
        isHudVisible: false,
      };

    case 'TOGGLE_HUD':
      return {
        ...state,
        isHudVisible: !state.isHudVisible,
      };

    case 'SHOW_HUD':
      return {
        ...state,
        isHudVisible: true,
      };

    case 'HIDE_HUD':
      return {
        ...state,
        isHudVisible: false,
      };

    case 'SET_COUNTDOWN':
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

    case 'START_COUNTDOWN':
      return {
        ...state,
        countdown: {
          ...state.countdown,
          isActive: true,
          endTimestamp: nowMs() + state.countdown.currentTime * 1000,
        },
      };

    case 'PAUSE_COUNTDOWN':
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

    case 'RESET_COUNTDOWN':
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

    case 'START_STOPWATCH':
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          isActive: true,
        },
      };

    case 'PAUSE_STOPWATCH':
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          isActive: false,
        },
      };

    case 'RESET_STOPWATCH':
      return {
        ...state,
        stopwatch: {
          elapsedTime: 0,
          isActive: false,
        },
      };

    case 'TICK_STOPWATCH':
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          elapsedTime: state.stopwatch.elapsedTime + STOPWATCH_TICK_MS,
        },
      };

    case 'TICK_STOPWATCH_BY':
      return {
        ...state,
        stopwatch: {
          ...state.stopwatch,
          elapsedTime: state.stopwatch.elapsedTime + action.payload * STOPWATCH_TICK_MS,
        },
      };

    case 'FINISH_COUNTDOWN':
      return {
        ...state,
        countdown: {
          ...state.countdown,
          currentTime: 0,
          isActive: false,
          endTimestamp: undefined,
        },
      };

    case 'OPEN_MODAL':
      return {
        ...state,
        isModalOpen: true,
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        isModalOpen: false,
      };

    case 'SET_TARGET_YEAR':
      const newStudyState = {
        ...state.study,
        targetYear: action.payload
      };
      // 保存到本地存储
      localStorage.setItem('study-target-year', action.payload.toString());
      return {
        ...state,
        study: newStudyState,
      };

    case 'SET_COUNTDOWN_TYPE':
      const typeUpdatedStudy = {
        ...state.study,
        countdownType: action.payload
      };
      localStorage.setItem('countdown-type', action.payload);
      return {
        ...state,
        study: typeUpdatedStudy,
      };

    case 'SET_CUSTOM_COUNTDOWN':
      const customUpdatedStudy = {
        ...state.study,
        customName: action.payload.name,
        customDate: action.payload.date
      };
      localStorage.setItem('custom-countdown-name', action.payload.name);
      localStorage.setItem('custom-countdown-date', action.payload.date);
      return {
        ...state,
        study: customUpdatedStudy,
      };

    case 'UPDATE_QUOTE_CHANNELS':
      const newQuoteChannelState = {
        channels: action.payload,
        lastUpdated: Date.now()
      };
      // 保存到本地存储
      localStorage.setItem('quote-channels', JSON.stringify(newQuoteChannelState));
      return {
        ...state,
        quoteChannels: newQuoteChannelState,
      };

    case 'TOGGLE_QUOTE_CHANNEL':
      const updatedChannels = state.quoteChannels.channels.map(channel =>
        channel.id === action.payload
          ? { ...channel, enabled: !channel.enabled }
          : channel
      );
      const toggledChannelState = {
        channels: updatedChannels,
        lastUpdated: Date.now()
      };
      localStorage.setItem('quote-channels', JSON.stringify(toggledChannelState));
      return {
        ...state,
        quoteChannels: toggledChannelState,
      };

    case 'UPDATE_QUOTE_CHANNEL_WEIGHT':
      const weightUpdatedChannels = state.quoteChannels.channels.map(channel =>
        channel.id === action.payload.id
          ? { ...channel, weight: action.payload.weight }
          : channel
      );
      const weightUpdatedState = {
        channels: weightUpdatedChannels,
        lastUpdated: Date.now()
      };
      localStorage.setItem('quote-channels', JSON.stringify(weightUpdatedState));
      return {
        ...state,
        quoteChannels: weightUpdatedState,
      };

    case 'UPDATE_QUOTE_CHANNEL_CATEGORIES':
      const categoriesUpdatedChannels = state.quoteChannels.channels.map(channel =>
        channel.id === action.payload.id
          ? { ...channel, hitokotoCategories: action.payload.categories }
          : channel
      );
      const categoriesUpdatedState = {
        channels: categoriesUpdatedChannels,
        lastUpdated: Date.now()
      };
      localStorage.setItem('quote-channels', JSON.stringify(categoriesUpdatedState));
      return {
        ...state,
        quoteChannels: categoriesUpdatedState,
      };

    case 'SET_QUOTE_AUTO_REFRESH_INTERVAL':
      const newQuoteSettings = {
        ...state.quoteSettings,
        autoRefreshInterval: action.payload
      };
      // 保存到本地存储
      localStorage.setItem('quote-auto-refresh-interval', action.payload.toString());
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
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
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
    throw new Error('useAppState must be used within an AppContextProvider');
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
    throw new Error('useAppDispatch must be used within an AppContextProvider');
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
