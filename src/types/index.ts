/**
 * 公告选项卡类型
 */
export type AnnouncementTab = 'announcement' | 'changelog';

/**
 * 公告选项卡配置接口
 */
export interface AnnouncementTabConfig {
  /** 选项卡标识 */
  key: AnnouncementTab;
  /** 显示标题 */
  title: string;
  /** 对应的Markdown文件名 */
  filename: string;
  /** 图标（可选） */
  icon?: string;
}

/**
 * 公告组件状态接口
 */
export interface AnnouncementState {
  /** 是否显示公告弹窗 */
  isVisible: boolean;
  /** 当前激活的选项卡 */
  activeTab: AnnouncementTab;
  /** 是否勾选"一周内不再显示" */
  dontShowAgain: boolean;
  /** 上次显示时间戳 */
  lastShownTime: number;
}

/**
 * 公告组件Props接口
 */
export interface AnnouncementModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 初始激活的选项卡 */
  initialTab?: AnnouncementTab;
}

/**
 * Markdown文档接口
 */
export interface MarkdownDocument {
  /** 文档内容 */
  content: string;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error?: string;
  /** 文件名 */
  filename: string;
}

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
  /** 目标结束时间戳（毫秒），用于精确倒计时） */
  endTimestamp?: number;
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
 * 晚自习页面组件显示设置
 */
export interface StudyDisplaySettings {
  /** 是否显示状态栏 */
  showStatusBar: boolean;
  /** 是否显示噪音监测 */
  showNoiseMonitor: boolean;
  /** 是否显示倒计时 */
  showCountdown: boolean;
  /** 是否显示励志金句 */
  showQuote: boolean;
  /** 是否显示当前时间 */
  showTime: boolean;
  /** 是否显示当前日期 */
  showDate: boolean;
}

/** 新增：多倒计时项目配置 */
export interface CountdownItem {
  /** 唯一标识 */
  id: string;
  /** 类型：高考或自定义 */
  kind: 'gaokao' | 'custom';
  /** 显示名称，例如“2026高考”或“期末考试” */
  name: string;
  /** 目标日期（YYYY-MM-DD，仅自定义项目使用） */
  targetDate?: string;
  /** 背景色 */
  bgColor?: string;
  /** 背景透明度（0-1） */
  bgOpacity?: number;
  /** 文字颜色 */
  textColor?: string;
  /** 文字透明度（0-1） */
  textOpacity?: number;
  /** 数字颜色（覆盖全局 digitColor） */
  digitColor?: string;
  /** 数字透明度（0-1，覆盖全局 digitOpacity） */
  digitOpacity?: number;
  /** 显示顺序（越小越靠前） */
  order: number;
}

/**
 * 晚自习状态接口
 */
export interface StudyState {
  /** 目标高考年份 */
  targetYear: number;
  /** 倒计时类型：高考或自定义事件 */
  countdownType?: 'gaokao' | 'custom';
  /** 自定义事件名称（当为自定义时使用） */
  customName?: string;
  /** 自定义事件日期（YYYY-MM-DD） */
  customDate?: string;
  /** 组件显示设置 */
  display?: StudyDisplaySettings;
  /** 新增：倒计时项目列表（包含高考与自定义项） */
  countdownItems?: CountdownItem[];
  /** 轮播间隔（秒，仅多事件模式下使用） */
  carouselIntervalSec?: number;
  /** 倒计时数字颜色（全局应用到天数字） */
  digitColor?: string;
  /** 倒计时数字透明度（0-1） */
  digitOpacity?: number;
}

/**
 * 一言分类类型
 * 只保留文学、哲学、诗词、抖机灵四个分类
 */
export type HitokotoCategory = 'd' | 'i' | 'k' | 'l';

/**
 * 一言分类映射
 */
export const HITOKOTO_CATEGORIES: Record<HitokotoCategory, string> = {
  d: '文学',
  i: '诗词',
  k: '哲学',
  l: '抖机灵'
};

/**
 * 一言分类数组（用于遍历）
 * 按照文化内涵排序：文学 -> 诗词 -> 哲学 -> 抖机灵
 */
export const HITOKOTO_CATEGORY_LIST: Array<{ key: HitokotoCategory; name: string }> = [
  { key: 'd', name: '文学' },
  { key: 'i', name: '诗词' },
  { key: 'k', name: '哲学' },
  { key: 'l', name: '抖机灵' }
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
 * 金句设置状态
 */
export interface QuoteSettingsState {
  /** 自动刷新间隔（秒），0表示关闭自动刷新 */
  autoRefreshInterval: number;
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
  /** 金句设置状态 */
  quoteSettings: QuoteSettingsState;
  /** 公告组件状态 */
  announcement: AnnouncementState;
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
  | { type: 'FINISH_COUNTDOWN' }
  | { type: 'START_STOPWATCH' }
  | { type: 'PAUSE_STOPWATCH' }
  | { type: 'RESET_STOPWATCH' }
  | { type: 'TICK_STOPWATCH' }
  | { type: 'TICK_STOPWATCH_BY'; payload: number }
  | { type: 'SET_TARGET_YEAR'; payload: number }
  | { type: 'SET_COUNTDOWN_TYPE'; payload: 'gaokao' | 'custom' }
  | { type: 'SET_CUSTOM_COUNTDOWN'; payload: { name: string; date: string } }
  | { type: 'UPDATE_QUOTE_CHANNELS'; payload: QuoteSourceConfig[] }
  | { type: 'TOGGLE_QUOTE_CHANNEL'; payload: string }
  | { type: 'UPDATE_QUOTE_CHANNEL_WEIGHT'; payload: { id: string; weight: number } }
  | { type: 'UPDATE_QUOTE_CHANNEL_CATEGORIES'; payload: { id: string; categories: HitokotoCategory[] } }
  | { type: 'SET_QUOTE_AUTO_REFRESH_INTERVAL'; payload: number }
  | { type: 'SHOW_ANNOUNCEMENT' }
  | { type: 'HIDE_ANNOUNCEMENT' }
  | { type: 'SET_ANNOUNCEMENT_TAB'; payload: AnnouncementTab }
  | { type: 'SET_ANNOUNCEMENT_DONT_SHOW_AGAIN'; payload: boolean }
  | { type: 'OPEN_MODAL' }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_STUDY_DISPLAY'; payload: StudyDisplaySettings }
  | { type: 'SET_COUNTDOWN_ITEMS'; payload: CountdownItem[] }
  | { type: 'SET_CAROUSEL_INTERVAL'; payload: number }
  | { type: 'SET_COUNTDOWN_DIGIT_COLOR'; payload: string | undefined }
  | { type: 'SET_COUNTDOWN_DIGIT_OPACITY'; payload: number | undefined }