import type { DropdownGroup, DropdownOption } from "./types";

/** 过滤选项（函数级注释：根据查询关键字过滤分组与普通选项） */
export function filterOptions(
  groups: DropdownGroup[] | undefined,
  options: DropdownOption[] | undefined,
  query: string
): { groups?: DropdownGroup[]; options?: DropdownOption[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { groups, options };
  const match = (s: string) => s.toLowerCase().includes(q);
  const nextGroups = groups
    ? groups
        .map((g) => ({
          label: g.label,
          options: g.options.filter((o) => match(o.label)),
        }))
        .filter((g) => g.options.length > 0)
    : undefined;
  const nextOptions = options ? options.filter((o) => match(o.label)) : undefined;
  return { groups: nextGroups, options: nextOptions };
}

/** 切换选中（函数级注释：在单选或多选模式下切换选中值，并返回新值） */
export function toggleValue(
  mode: "single" | "multiple",
  current: string | number | Array<string | number> | undefined,
  next: string | number
): string | number | Array<string | number> | undefined {
  if (mode === "single") return next;
  const arr = Array.isArray(current) ? current.slice() : [];
  const idx = arr.findIndex((v) => v === next);
  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    arr.push(next);
  }
  return arr;
}
