import React, { useEffect, useState, useCallback } from "react";

import { useAppState, useAppDispatch } from "../../../contexts/AppContext";
import { CountdownItem } from "../../../types";
import {
  FormRow,
  FormInput,
  FormButton,
  FormButtonGroup,
  FormSlider,
  FormSegmented,
} from "../../FormComponents";
import styles from "../SettingsPanel.module.css";

interface CountdownDraftItem {
  id: string;
  kind: "gaokao" | "custom";
  name?: string;
  targetDate?: string; // YYYY-MM-DD
  styleMode?: "default" | "custom";
  bgColor?: string;
  bgOpacity?: number;
  textColor?: string;
  textOpacity?: number;
  digitColor?: string;
  digitOpacity?: number;
  order?: number;
}

export interface CountdownManagerPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 倒计时管理：添加/删除/编辑/拖拽排序
 */
export const CountdownManagerPanel: React.FC<CountdownManagerPanelProps> = ({ onRegisterSave }) => {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<CountdownDraftItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // 初始化草稿
  useEffect(() => {
    const origin = (study.countdownItems || []) as CountdownDraftItem[];
    const init: CountdownDraftItem[] =
      origin.length > 0
        ? [...origin].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : [{ id: "gaokao-default", kind: "gaokao", name: "高考倒计时", order: 0 }];
    setItems(
      init.map((it, idx) => ({
        ...it,
        order: idx,
        styleMode:
          it.styleMode === "default" || it.styleMode === "custom"
            ? it.styleMode
            : (it.bgColor && it.bgColor.trim().length > 0) ||
                (typeof it.bgOpacity === "number" && it.bgOpacity !== 0) ||
                (it.textColor && it.textColor.trim().length > 0) ||
                (typeof it.textOpacity === "number" && it.textOpacity !== 1) ||
                (it.digitColor && it.digitColor.trim().length > 0) ||
                typeof it.digitOpacity === "number"
              ? "custom"
              : "default",
        bgOpacity: typeof it.bgOpacity === "number" ? it.bgOpacity : 0,
        textOpacity: typeof it.textOpacity === "number" ? it.textOpacity : 1,
        digitColor: it.digitColor,
        digitOpacity: typeof it.digitOpacity === "number" ? it.digitOpacity : undefined,
      }))
    );
  }, [study.countdownItems]);

  // 保存注册
  useEffect(() => {
    onRegisterSave?.(() => {
      // 重新编号 order 并持久化，确保字段完整且按类型规范
      const normalized: CountdownItem[] = items.map((it, idx) => {
        const isCustomStyle = (it.styleMode ?? "default") === "custom";
        return {
          id: it.id,
          kind: it.kind,
          name:
            it.name && it.name.trim().length > 0
              ? it.name.trim()
              : it.kind === "gaokao"
                ? "高考倒计时"
                : "自定义事件",
          targetDate:
            it.kind === "custom" ? (it.targetDate && it.targetDate.trim()) || "" : undefined,
          bgColor:
            isCustomStyle && it.bgColor && it.bgColor.trim().length > 0
              ? it.bgColor.trim()
              : undefined,
          bgOpacity: isCustomStyle && typeof it.bgOpacity === "number" ? it.bgOpacity : 0,
          textColor:
            isCustomStyle && it.textColor && it.textColor.trim().length > 0
              ? it.textColor.trim()
              : undefined,
          textOpacity: isCustomStyle && typeof it.textOpacity === "number" ? it.textOpacity : 1,
          digitColor:
            isCustomStyle && it.digitColor && it.digitColor.trim().length > 0
              ? it.digitColor.trim()
              : undefined,
          digitOpacity:
            isCustomStyle && typeof it.digitOpacity === "number" ? it.digitOpacity : undefined,
          order: idx,
        };
      });
      dispatch({ type: "SET_COUNTDOWN_ITEMS", payload: normalized });
    });
  }, [onRegisterSave, items, dispatch]);

  const addCustom = useCallback(() => {
    const id = `custom-${Date.now()}`;
    const nextOrder = items.length;
    setItems([
      ...items,
      {
        id,
        kind: "custom",
        name: "期末考试",
        targetDate: "",
        styleMode: "default",
        order: nextOrder,
        bgOpacity: 0,
        textOpacity: 1,
      },
    ]);
  }, [items]);

  const addGaokao = useCallback(() => {
    const id = `gaokao-${Date.now()}`;
    const nextOrder = items.length;
    setItems([
      ...items,
      {
        id,
        kind: "gaokao",
        name: "高考倒计时",
        styleMode: "default",
        order: nextOrder,
        bgOpacity: 0,
        textOpacity: 1,
      },
    ]);
  }, [items]);

  const updateItem = useCallback((id: string, patch: Partial<CountdownDraftItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id).map((it, idx) => ({ ...it, order: idx })));
  }, []);

  // 拖拽排序
  const onDragStart = useCallback((id: string) => setDraggingId(id), []);
  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, overId: string) => {
      e.preventDefault();
      const fromIndex = items.findIndex((it) => it.id === draggingId);
      const toIndex = items.findIndex((it) => it.id === overId);
      if (draggingId && fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        const next = [...items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        setItems(next.map((it, idx) => ({ ...it, order: idx })));
      }
    },
    [draggingId, items]
  );
  const onDragEnd = useCallback(() => setDraggingId(null), []);

  return (
    <div className={styles.section}>
      {/* 删除标题 */}
      <p className={styles.helpText}>
        添加多个倒计时项目，并可拖动排序；自定义名称、目标日期与颜色。
      </p>
      <div className={styles.scheduleList}>
        {items.map((it) => (
          <div
            key={it.id}
            className={styles.periodItem}
            draggable
            onDragStart={() => onDragStart(it.id)}
            onDragOver={(e) => onDragOver(e, it.id)}
            onDragEnd={onDragEnd}
            aria-grabbed={draggingId === it.id}
            style={{ cursor: "grab" }}
          >
            <div className={styles.periodDisplay}>
              <div className={styles.periodInfo}>
                <div className={styles.periodName}>
                  {it.kind === "gaokao" ? "高考倒计时" : "自定义事件"}
                </div>
                <div className={styles.periodTime}>
                  {it.kind === "gaokao" ? "自动计算至最近6月7日" : it.targetDate || "请选择日期"}
                </div>
              </div>
              <FormButtonGroup>
                <FormButton variant="danger" onClick={() => removeItem(it.id)}>
                  删除
                </FormButton>
              </FormButtonGroup>
            </div>

            {/* 编辑区域：紧凑布局 */}
            <div className={styles.editFormCompact}>
              <FormRow gap="sm" align="center">
                <FormInput
                  label="名称"
                  type="text"
                  value={it.name || ""}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  placeholder={it.kind === "gaokao" ? "例如：2026高考" : "例如：期末考试"}
                />

                {it.kind === "custom" && (
                  <FormInput
                    label="目标日期"
                    type="date"
                    value={it.targetDate || ""}
                    onChange={(e) => updateItem(it.id, { targetDate: e.target.value })}
                  />
                )}
                <FormSegmented
                  label="样式"
                  value={it.styleMode ?? "default"}
                  options={[
                    { label: "默认", value: "default" },
                    { label: "自定义", value: "custom" },
                  ]}
                  onChange={(v) => updateItem(it.id, { styleMode: v as "default" | "custom" })}
                />
              </FormRow>

              {(it.styleMode ?? "default") === "custom" && (
                <FormRow gap="sm" align="center">
                  <FormInput
                    label="背景色"
                    type="color"
                    value={it.bgColor || "#121212"}
                    onChange={(e) => updateItem(it.id, { bgColor: e.target.value })}
                    style={{ width: 36, height: 36, padding: 0 }}
                  />
                  <FormSlider
                    label="背景透明度"
                    min={0}
                    max={1}
                    step={0.01}
                    value={typeof it.bgOpacity === "number" ? it.bgOpacity : 0}
                    onChange={(v) => updateItem(it.id, { bgOpacity: v })}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                  />
                  <FormInput
                    label="文字色"
                    type="color"
                    value={it.textColor || "#E0E0E0"}
                    onChange={(e) => updateItem(it.id, { textColor: e.target.value })}
                    style={{ width: 36, height: 36, padding: 0 }}
                  />
                  <FormSlider
                    label="文字透明度"
                    min={0}
                    max={1}
                    step={0.01}
                    value={typeof it.textOpacity === "number" ? it.textOpacity : 1}
                    onChange={(v) => updateItem(it.id, { textOpacity: v })}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                  />
                  <FormInput
                    label="数字颜色"
                    type="color"
                    value={it.digitColor ?? (study.digitColor || "#03DAC6")}
                    onChange={(e) => updateItem(it.id, { digitColor: e.target.value })}
                    style={{ width: 36, height: 36, padding: 0 }}
                  />
                  <FormSlider
                    label="数字透明度"
                    min={0}
                    max={1}
                    step={0.01}
                    value={
                      typeof it.digitOpacity === "number"
                        ? it.digitOpacity
                        : typeof study.digitOpacity === "number"
                          ? study.digitOpacity
                          : 1
                    }
                    onChange={(v) => updateItem(it.id, { digitOpacity: v })}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                  />
                </FormRow>
              )}
            </div>
          </div>
        ))}
      </div>

      <FormButtonGroup align="left">
        <FormButton variant="secondary" onClick={addGaokao}>
          添加高考倒计时
        </FormButton>
        <FormButton variant="primary" onClick={addCustom}>
          添加自定义倒计时
        </FormButton>
      </FormButtonGroup>
    </div>
  );
};

export default CountdownManagerPanel;
