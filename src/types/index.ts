/**
 * 应用模式类型
 * clock: 时钟模式
 * countdown: 倒计时模式
 * stopwatch: 秒表模式
 */
export type AppMode = 'clock' | 'countdown' | 'stopwatch';

/**
 * 倒计时状态接口
 */
export interface CountdownState {
  /** 初始时间（秒） */
  initialTime: number;
  /** 当前剩余时间（秒） */
  currentTime: number;
  /** 是否正在运行 */
  isActive: boolean;
}

/**
 * 秒表状态接口
 */
export interface StopwatchState {
  /** 已经过时间（毫秒） */
  elapsedTime: number;
  /** 是否正在运行 */
  isActive: boolean;
}

/**
 * 应用全局状态接口
 */
export interface AppState {
  /** 当前模式 */
  mode: AppMode;
  /** HUD是否可见 */
  isHudVisible: boolean;
  /** 倒计时状态 */
  countdown: CountdownState;
  /** 秒表状态 */
  stopwatch: StopwatchState;
  /** 模态框是否打开 */
  isModalOpen: boolean;
}

/**
 * 应用动作类型
 */
export type AppAction =
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'TOGGLE_HUD' }
  | { type: 'SHOW_HUD' }
  | { type: 'HIDE_HUD' }
  | { type: 'SET_COUNTDOWN'; payload: number }
  | { type: 'START_COUNTDOWN' }
  | { type: 'PAUSE_COUNTDOWN' }
  | { type: 'RESET_COUNTDOWN' }
  | { type: 'TICK_COUNTDOWN' }
  | { type: 'START_STOPWATCH' }
  | { type: 'PAUSE_STOPWATCH' }
  | { type: 'RESET_STOPWATCH' }
  | { type: 'TICK_STOPWATCH' }
  | { type: 'OPEN_MODAL' }
  | { type: 'CLOSE_MODAL' };