/**
 * 应用模式类型
 * clock: 时钟模式
 * countdown: 倒计时模式
 * stopwatch: 秒表模式
 * study: 晚自习模式
 */
export type AppMode = 'clock' | 'countdown' | 'stopwatch' | 'study';

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
 * 晚自习状态接口
 */
export interface StudyState {
  /** 目标高考年份 */
  targetYear: number;
}

/**
 * 一言分类类型
 * 根据一言API官方文档定义的分类
 */
export type HitokotoCategory = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l';

/**
 * 一言分类映射
 */
export const HITOKOTO_CATEGORIES: Record<HitokotoCategory, string> = {
  a: '动画',
  b: '漫画', 
  c: '游戏',
  d: '文学',
  e: '原创',
  f: '来自网络',
  g: '其他',
  h: '影视',
  i: '诗词',
  j: '网易云',
  k: '哲学',
  l: '抖机灵'
};

/**
 * 一言分类数组（用于遍历）
 * 按照逻辑分组排序：娱乐类 -> 文化类 -> 网络类 -> 其他类
 */
export const HITOKOTO_CATEGORY_LIST: Array<{ key: HitokotoCategory; name: string }> = [
  // 娱乐文化类
  { key: 'a', name: '动画' },
  { key: 'b', name: '漫画' },
  { key: 'c', name: '游戏' },
  { key: 'h', name: '影视' },
  { key: 'j', name: '网易云' },
  // 文学哲学类
  { key: 'd', name: '文学' },
  { key: 'i', name: '诗词' },
  { key: 'k', name: '哲学' },
  // 创作类
  { key: 'e', name: '原创' },
  { key: 'l', name: '抖机灵' },
  // 网络来源类
  { key: 'f', name: '来自网络' },
  // 其他类（放在最后）
  { key: 'g', name: '其他' }
];

/**
 * 金句数据源配置类型
 */
export interface QuoteSourceConfig {
  /** 数据源ID */
  id: string;
  /** 数据源名称 */
  name: string;
  /** 权重值 1-99 */
  weight: number;
  /** 是否启用 */
  enabled: boolean;
  /** 是否线上拉取 */
  onlineFetch: boolean;
  /** API 地址（如适用） */
  apiEndpoint?: string;
  /** 一言分类选择（仅当为一言API时） */
  hitokotoCategories?: HitokotoCategory[];
  /** 本地语录 */
  quotes?: string[];
}

/**
 * 金句渠道管理状态
 */
export interface QuoteChannelState {
  /** 渠道配置列表 */
  channels: QuoteSourceConfig[];
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 一言 API 返回数据类型
 */
export interface HitokotoResponse {
  /** 一言正文 */
  hitokoto: string;
  /** 分类 */
  type?: string;
  /** 来源 */
  from?: string;
  /** 作者 */
  from_who?: string | null;
  /** 一言标识 */
  id?: number;
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
  /** 晚自习状态 */
  study: StudyState;
  /** 金句渠道管理状态 */
  quoteChannels: QuoteChannelState;
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
  | { type: 'SET_TARGET_YEAR'; payload: number }
  | { type: 'UPDATE_QUOTE_CHANNELS'; payload: QuoteSourceConfig[] }
  | { type: 'TOGGLE_QUOTE_CHANNEL'; payload: string }
  | { type: 'UPDATE_QUOTE_CHANNEL_WEIGHT'; payload: { id: string; weight: number } }
  | { type: 'UPDATE_QUOTE_CHANNEL_CATEGORIES'; payload: { id: string; categories: HitokotoCategory[] } }
  | { type: 'OPEN_MODAL' }
  | { type: 'CLOSE_MODAL' };