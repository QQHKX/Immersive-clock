import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  buttonRef: React.RefObject<HTMLButtonElement>;
}) {
  const { open } = useDropdownContext();
  const { width, disabled, variant, label, onClick, id, buttonRef } = props;
  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      className={`dd-trigger ${disabled ? "dd-disabled" : ""} ${variant === "ghost" ? "dd-ghost" : ""}`}
      style={{ width: width ? `${width}px` : undefined }}
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={`${id}-menu`}
      disabled={!!disabled}
    >
      <span>{label}</span>
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
  mode: "single" | "multiple";
  value: DropdownValue | DropdownValue[] | undefined;
  triggerRef: React.RefObject<HTMLButtonElement>;
  portalContainer?: HTMLElement | null;
}) {
  const {
    id,
    groups,
    options,
    searchable,
    maxMenuHeight,
    onSelect,
    mode,
    value,
    triggerRef,
    portalContainer,
  } = props;
  const { open, setOpen, query, setQuery } = useDropdownContext();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const filtered = useMemo(() => filterOptions(groups, options, query), [groups, options, query]);
  const hasItems =
    (filtered.groups && filtered.groups.some((g) => g.options.length > 0)) ||
    (filtered.options && filtered.options.length > 0);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const menuEl = listRef.current;
      const triggerEl = triggerRef.current;
      if (!menuEl || !triggerEl) return;
      if (e.target instanceof Node && !menuEl.contains(e.target)) {
        if (!triggerEl.contains(e.target)) setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [triggerRef, setOpen]);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const triggerEl = triggerRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const preferBelow = true;
      const gap = 4;
      const belowSpace = window.innerHeight - rect.bottom;
      const aboveSpace = rect.top;
      const placeBelow = preferBelow
        ? belowSpace >= 120 || belowSpace >= aboveSpace
        : belowSpace >= aboveSpace;
      if (placeBelow) {
        setMenuStyle({
          position: "fixed",
          top: rect.bottom + gap,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setMenuStyle({
          position: "fixed",
          bottom: window.innerHeight - rect.top + gap,
          left: rect.left,
          width: rect.width,
        });
      }
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, triggerRef]);

  if (!open) return null;
  const selectedSet = new Set(mode === "multiple" ? (Array.isArray(value) ? value : []) : []);
  const isSelected = (opt: DropdownOption) => {
    if (mode === "single") return value === opt.value;
    return selectedSet.has(opt.value);
  };

  const content = (
    <div
      id={`${id}-menu`}
      role="listbox"
      aria-multiselectable={mode === "multiple" ? true : undefined}
      className="dd-menu"
      style={menuStyle}
      ref={listRef}
    >
      {searchable && (
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
      <div className="dd-list" role="presentation" style={{ maxHeight: maxMenuHeight }}>
        {!hasItems && <div className="dd-empty">暂无匹配项</div>}
        {filtered.groups?.map((g, gi) => (
          <React.Fragment key={`g-${gi}`}>
            <div className="dd-group">{g.label}</div>
            {g.options.map((opt, oi) => (
              <div
                key={`g-${gi}-o-${oi}`}
                role="option"
                aria-selected={isSelected(opt)}
                className={`dd-option ${isSelected(opt) ? "dd-active" : ""} ${
                  opt.disabled ? "dd-disabled" : ""
                }`}
                onClick={() => !opt.disabled && onSelect(opt)}
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
            aria-selected={isSelected(opt)}
            className={`dd-option ${isSelected(opt) ? "dd-active" : ""} ${
              opt.disabled ? "dd-disabled" : ""
            }`}
            onClick={() => !opt.disabled && onSelect(opt)}
            tabIndex={0}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
  const container = portalContainer ?? (typeof document !== "undefined" ? document.body : null);
  return container ? createPortal(content, container) : content;
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
  const triggerRef = useRef<HTMLButtonElement>(null);
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
        buttonRef={triggerRef}
        onClick={() => !p.disabled && setOpen(!open)}
      />
      <Menu
        id={p.triggerId}
        groups={p.groups}
        options={p.options}
        searchable={p.searchable}
        maxMenuHeight={p.maxMenuHeight}
        onSelect={onSelect}
        mode={mode}
        value={value}
        triggerRef={triggerRef}
        portalContainer={p.portalContainer}
      />
    </div>
  );
}
