import { useState, useCallback } from "react";

/**
 * 草稿状态管理 Hook
 * 用于设置面板中的草稿-保存模式，减少重复代码
 *
 * @template T - 草稿状态的类型
 * @param initial - 初始状态或返回初始状态的函数（应用 rerender-lazy-state-init）
 * @param onSave - 保存回调函数
 * @returns 草稿状态管理对象
 */
export function useDraftState<T extends Record<string, unknown>>(
  initial: T | (() => T),
  onSave?: (draft: T) => void
): {
  draft: T;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(key: K, value: T[K]) => void;
  registerSave: () => (() => void) | undefined;
} {
  const [draft, setDraft] = useState<T>(initial);

  /**
   * 更新单个字段
   * 应用 rerender-functional-setState 最佳实践：使用函数式更新
   */
  const updateField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * 注册保存函数
   * 返回一个函数，调用后会使用当前草稿状态触发保存
   */
  const registerSave = useCallback(() => {
    if (!onSave) {
      return undefined;
    }
    return () => {
      onSave(draft);
    };
  }, [draft, onSave]);

  return { draft, setDraft, updateField, registerSave };
}
