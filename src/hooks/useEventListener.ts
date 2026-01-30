import { useEffect, useRef } from "react";

/**
 * 事件监听器 Hook
 * 用于管理全局事件监听，自动清理，避免内存泄漏
 * 应用 client-event-listeners 最佳实践
 *
 * @template TEvent - 事件类型
 * @param eventName - 事件名称
 * @param handler - 事件处理函数
 * @param target - 事件目标，默认为 window
 * @param options - 事件监听选项
 * @returns 清理函数（可选，用于手动清理）
 */
export function useEventListener<TEvent extends Event = Event>(
  eventName: string,
  handler: (event: TEvent) => void,
  target: EventTarget = window,
  options?: AddEventListenerOptions | boolean
): () => void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!target?.addEventListener) {
      return;
    }

    const listener: EventListener = (event) => {
      handlerRef.current(event as TEvent);
    };

    target.addEventListener(eventName, listener, options);

    return () => {
      target.removeEventListener(eventName, listener, options);
    };
  }, [eventName, target, options]);

  return () => {
    if (target?.removeEventListener) {
      target.removeEventListener(eventName, handlerRef.current as EventListener, options);
    }
  };
}

interface EventTarget {
  addEventListener: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ) => void;
}
