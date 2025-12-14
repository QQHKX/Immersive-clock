export type DropdownValue = string | number;

export interface DropdownOption {
  label: string;
  value: DropdownValue;
  disabled?: boolean;
}

export interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

export interface DropdownProps {
  /** 单选或多选 */
  mode?: "single" | "multiple";
  /** 值：单选为字符串/数字，多选为数组 */
  value?: DropdownValue | DropdownValue[];
  /** 选项或分组选项 */
  options?: DropdownOption[];
  groups?: DropdownGroup[];
  /** 占位文案 */
  placeholder?: string;
  /** 是否允许搜索 */
  searchable?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 宽度（像素） */
  width?: number;
  /** 变体：用于不同场景的视觉风格 */
  variant?: "default" | "ghost";
  /** 选中回调 */
  onChange?: (next: DropdownValue | DropdownValue[] | undefined) => void;
  /** 自定义渲染标签 */
  renderLabel?: (opt: DropdownOption) => string;
  /** 菜单最大高度（像素） */
  maxMenuHeight?: number;
  /** 浮层挂载容器 */
  portalContainer?: HTMLElement | null;
}

export interface DropdownContextValue {
  open: boolean;
  query: string;
  mode: "single" | "multiple";
  value: DropdownValue | DropdownValue[] | undefined;
  setOpen: (v: boolean) => void;
  setQuery: (q: string) => void;
  setValue: (v: DropdownValue | DropdownValue[] | undefined) => void;
}
