import React, { createContext, useContext, useMemo, useState } from "react";

import type { DropdownContextValue, DropdownValue } from "./types";

const Ctx = createContext<DropdownContextValue | null>(null);

/** 创建下拉状态上下文（函数级注释：为组件树提供打开状态、查询与选中值管理） */
export function DropdownProvider(props: {
  mode: "single" | "multiple";
  value?: DropdownValue | DropdownValue[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState<DropdownValue | DropdownValue[] | undefined>(props.value);

  const ctx = useMemo<DropdownContextValue>(
    () => ({
      open,
      query,
      mode: props.mode,
      value,
      setOpen,
      setQuery,
      setValue,
    }),
    [open, query, props.mode, value]
  );

  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>;
}

/** 读取下拉上下文（函数级注释：暴露给外部组件与 hooks 使用） */
export function useDropdownContext(): DropdownContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("Dropdown context not found");
  }
  return v;
}
