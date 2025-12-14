import React, { useEffect, useMemo, useRef } from "react";

import { DropdownProvider, useDropdownContext } from "./DropdownContext";
import { ensureDropdownStyles } from "./styles";
import type { DropdownProps, DropdownOption, DropdownGroup, DropdownValue } from "./types";
import { filterOptions, toggleValue } from "./utils";

/** 下拉菜单触发器（函数级注释：渲染可点击的触发按钮，展示当前选中值与展开状态） */
function Trigger(props: {
  width?: number;
  disabled?: boolean;
  variant?: "default" | "ghost";
  label: string;
  onClick: () => void;
  id: string;
}) {
  const { open } = useDropdownContext();
  return (
    <button
      id={props.id}
      type="button"
      className={`dd-trigger ${props.disabled ? "dd-disabled" : ""} ${
        props.variant === "ghost" ? "dd-ghost" : ""
      }`}
      style={{ width: props.width ? `${props.width}px` : undefined }}
      onClick={props.onClick}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={`${props.id}-menu`}
      disabled={!!props.disabled}
    >
      <span>{props.label}</span>
      <span className="dd-caret" />
    </button>
  );
}

/** 下拉菜单浮层（函数级注释：包含搜索框、分组与选项列表，支持键盘导航与触控） */
function Menu(props: {
  id: string;
  groups?: DropdownGroup[];
  options?: DropdownOption[];
  searchable?: boolean;
  maxMenuHeight?: number;
  onSelect: (opt: DropdownOption) => void;
}) {
  const { open, setOpen, query, setQuery } = useDropdownContext();
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(
    () => filterOptions(props.groups, props.options, query),
    [props.groups, props.options, query]
  );
  const hasItems =
    (filtered.groups && filtered.groups.some((g) => g.options.length > 0)) ||
    (filtered.options && filtered.options.length > 0);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!listRef.current) return;
      if (e.target instanceof Node && !listRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [setOpen]);

  if (!open) return null;
  return (
    <div
      id={`${props.id}-menu`}
      role="listbox"
      aria-multiselectable={false}
      className="dd-menu"
      style={{ maxHeight: props.maxMenuHeight ? `${props.maxMenuHeight}px` : undefined }}
      ref={listRef}
    >
      {props.searchable && (
        <div className="dd-search">
          <input
            type="text"
            aria-label="搜索选项"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索..."
          />
        </div>
      )}
      <div className="dd-list" role="presentation">
        {!hasItems && <div className="dd-empty">暂无匹配项</div>}
        {filtered.groups?.map((g, gi) => (
          <React.Fragment key={`g-${gi}`}>
            <div className="dd-group">{g.label}</div>
            {g.options.map((opt, oi) => (
              <div
                key={`g-${gi}-o-${oi}`}
                role="option"
                aria-selected={false}
                className={`dd-option ${opt.disabled ? "dd-disabled" : ""}`}
                onClick={() => !opt.disabled && props.onSelect(opt)}
                tabIndex={0}
              >
                {opt.label}
              </div>
            ))}
          </React.Fragment>
        ))}
        {filtered.options?.map((opt, oi) => (
          <div
            key={`o-${oi}`}
            role="option"
            aria-selected={false}
            className={`dd-option ${opt.disabled ? "dd-disabled" : ""}`}
            onClick={() => !opt.disabled && props.onSelect(opt)}
            tabIndex={0}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 下拉菜单主组件（函数级注释：提供上下文与样式注入，支持单选/多选与分组、搜索等功能） */
export const Dropdown: React.FC<DropdownProps> = (p) => {
  useEffect(() => {
    ensureDropdownStyles();
  }, []);

  const mode = p.mode || "single";
  const placeholder = p.placeholder || "请选择";
  const triggerId = useMemo(() => `dd-${Math.random().toString(36).slice(2, 8)}`, []);

  const label = (() => {
    if (mode === "single") {
      const v = p.value as DropdownValue | undefined;
      const all: DropdownOption[] = [
        ...(p.options || []),
        ...(p.groups ? p.groups.flatMap((g) => g.options) : []),
      ];
      const found = all.find((o) => o.value === v);
      return found ? (p.renderLabel ? p.renderLabel(found) : found.label) : placeholder;
    }
    const arr = Array.isArray(p.value) ? (p.value as DropdownValue[]) : [];
    return arr.length > 0 ? `已选 ${arr.length}` : placeholder;
  })();

  return (
    <DropdownProvider mode={mode} value={p.value}>
      <InnerDropdown {...p} triggerId={triggerId} label={label} />
    </DropdownProvider>
  );
};

/** 内部包装（函数级注释：处理交互事件与对外 onChange 的协调） */
function InnerDropdown(p: DropdownProps & { triggerId: string; label: string }) {
  const { open, setOpen, mode, value, setValue } = useDropdownContext();
  const onSelect = (opt: DropdownOption) => {
    const next = toggleValue(mode, value, opt.value);
    setValue(next);
    p.onChange?.(next as DropdownValue | DropdownValue[] | undefined);
    if (mode === "single") setOpen(false);
  };
  return (
    <div className="dd-root" style={{ width: p.width ? `${p.width}px` : undefined }}>
      <Trigger
        id={p.triggerId}
        width={p.width}
        disabled={p.disabled}
        variant={p.variant}
        label={p.label}
        onClick={() => !p.disabled && setOpen(!open)}
      />
      <Menu
        id={p.triggerId}
        groups={p.groups}
        options={p.options}
        searchable={p.searchable}
        maxMenuHeight={p.maxMenuHeight}
        onSelect={onSelect}
      />
    </div>
  );
}
