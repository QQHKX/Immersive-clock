import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppState, AppAction, AppMode, StudyState, HomeworkItem } from '../types';


/**
 * 从本地存储加载晚自习状态
 */
function loadStudyState(): StudyState {
  try {
    const savedTargetYear = localStorage.getItem('study-target-year');
    const savedHomeworks = localStorage.getItem('study-homeworks');
    
    const currentYear = new Date().getFullYear();
    const targetYear = savedTargetYear ? parseInt(savedTargetYear, 10) : currentYear + 1;
    
    let homeworks: HomeworkItem[] = [];
    if (savedHomeworks) {
      const parsed = JSON.parse(savedHomeworks);
      homeworks = parsed.map((hw: any) => ({
        ...hw,
        createdAt: new Date(hw.createdAt)
      }));
    }
    
    return {
      targetYear,
      homeworks
    };
  } catch (error) {
    console.warn('Failed to load study state from localStorage:', error);
    return {
      targetYear: new Date().getFullYear() + 1,
      homeworks: []
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
        },
      };

    case 'START_COUNTDOWN':
      return {
        ...state,
        countdown: {
          ...state.countdown,
          isActive: true,
        },
      };

    case 'PAUSE_COUNTDOWN':
      return {
        ...state,
        countdown: {
          ...state.countdown,
          isActive: false,
        },
      };

    case 'RESET_COUNTDOWN':
      return {
        ...state,
        countdown: {
          ...state.countdown,
          currentTime: state.countdown.initialTime,
          isActive: false,
        },
      };

    case 'TICK_COUNTDOWN':
      const newCurrentTime = Math.max(0, state.countdown.currentTime - 1);
      return {
        ...state,
        countdown: {
          ...state.countdown,
          currentTime: newCurrentTime,
          // 如果倒计时结束，自动停止
          isActive: newCurrentTime > 0 ? state.countdown.isActive : false,
        },
      };

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
          elapsedTime: state.stopwatch.elapsedTime + 10, // 增加10毫秒
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

    case 'ADD_HOMEWORK': {
      const newHomework: HomeworkItem = {
        ...action.payload,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date()
      };
      const updatedHomeworks = [...state.study.homeworks, newHomework];
      // 保存到本地存储
      localStorage.setItem('study-homeworks', JSON.stringify(updatedHomeworks));
      return {
        ...state,
        study: {
          ...state.study,
          homeworks: updatedHomeworks
        }
      };
    }

    case 'UPDATE_HOMEWORK': {
      const updatedHomeworks = state.study.homeworks.map(hw =>
        hw.id === action.payload.id
          ? { ...hw, ...action.payload.updates }
          : hw
      );
      // 保存到本地存储
      localStorage.setItem('study-homeworks', JSON.stringify(updatedHomeworks));
      return {
        ...state,
        study: {
          ...state.study,
          homeworks: updatedHomeworks
        }
      };
    }

    case 'DELETE_HOMEWORK': {
      const updatedHomeworks = state.study.homeworks.filter(hw => hw.id !== action.payload);
      // 保存到本地存储
      localStorage.setItem('study-homeworks', JSON.stringify(updatedHomeworks));
      return {
        ...state,
        study: {
          ...state.study,
          homeworks: updatedHomeworks
        }
      };
    }

    case 'TOGGLE_HOMEWORK': {
      const updatedHomeworks = state.study.homeworks.map(hw =>
        hw.id === action.payload
          ? { ...hw, completed: !hw.completed }
          : hw
      );
      // 保存到本地存储
      localStorage.setItem('study-homeworks', JSON.stringify(updatedHomeworks));
      return {
        ...state,
        study: {
          ...state.study,
          homeworks: updatedHomeworks
        }
      };
    }

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