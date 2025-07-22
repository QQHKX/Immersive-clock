/**
 * Microsoft Clarity 工具函数
 * 提供与 Clarity 分析工具交互的方法
 */

/**
 * 记录自定义事件
 * @param eventName 事件名称
 * @param eventProperties 事件属性（可选）
 */
export function trackEvent(eventName: string, eventProperties?: Record<string, any>): void {
  if (typeof window !== 'undefined' && (window as any).clarity) {
    (window as any).clarity('event', eventName, eventProperties);
  }
}

/**
 * 设置用户ID
 * @param userId 用户唯一标识符
 */
export function setUserId(userId: string): void {
  if (typeof window !== 'undefined' && (window as any).clarity) {
    (window as any).clarity('identify', userId);
  }
}

/**
 * 设置自定义会话属性
 * @param key 属性键名
 * @param value 属性值
 */
export function setSessionProperty(key: string, value: string): void {
  if (typeof window !== 'undefined' && (window as any).clarity) {
    (window as any).clarity('set', key, value);
  }
}