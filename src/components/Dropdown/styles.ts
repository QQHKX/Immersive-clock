const STYLE_ID = "dropdown-component-style";

/** 生成样式文本（函数级注释：根据 CSS 变量构建组件样式，保证与全局配色一致） */
export function createDropdownStyleText(): string {
  return `
.dd-root {
  position: relative;
  font-family: var(--font-ui);
  overflow: visible;
}
.dd-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: #fff;
  transition: all .2s ease;
}
.dd-trigger:hover {
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.08);
}
.dd-trigger.dd-disabled {
  opacity: .6;
  cursor: not-allowed;
}
.dd-trigger.dd-ghost {
  background: transparent;
  border-color: rgba(255,255,255,0.12);
}
.dd-caret {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid rgba(255,255,255,0.8);
}
.dd-menu {
  position: absolute;
  z-index: 9999;
  margin-top: 4px;
  border-radius: 10px;
  background: #1e1e1e;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 10px 24px rgba(0,0,0,0.35);
  overflow: hidden;
}
.dd-search {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.dd-search input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #fff;
  outline: none;
}
.dd-list {
  max-height: 200px;
  overflow: auto;
}
.dd-group {
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(255,255,255,0.65);
  background: rgba(255,255,255,0.04);
}
.dd-option {
  padding: 8px 10px;
  color: #fff;
  cursor: pointer;
  transition: background .15s ease;
  outline: none;
  line-height: 1.2;
}
.dd-option:hover,
.dd-option.dd-active {
  background: rgba(255,255,255,0.12);
}
.dd-option.dd-disabled {
  opacity: .5;
  cursor: not-allowed;
}
.dd-empty {
  padding: 12px;
  color: rgba(255,255,255,0.65);
}
`;
}

/** 注入样式（函数级注释：确保样式只注入一次，避免重复） */
export function ensureDropdownStyles(): void {
  if (typeof document === "undefined") return;
  const exist = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (exist) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = createDropdownStyleText();
  document.head.appendChild(style);
}
