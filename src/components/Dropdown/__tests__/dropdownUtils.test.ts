import { describe, it, expect } from "vitest";

import { filterOptions, toggleValue } from "../utils";

/** 过滤与切换逻辑单元测试（函数级注释：覆盖常见用例与边界条件） */
describe("dropdown utils", () => {
  it("filterOptions with query", () => {
    const groups = [
      { label: "Group A", options: [{ label: "Alpha", value: "a" }] },
      { label: "Group B", options: [{ label: "Beta", value: "b" }] },
    ];
    const options = [
      { label: "Gamma", value: "g" },
      { label: "Delta", value: "d" },
    ];
    const { groups: g2, options: o2 } = filterOptions(groups, options, "a");
    expect(g2?.length).toBe(1);
    expect(g2?.[0].options[0].label).toBe("Alpha");
    expect(o2?.length).toBe(1);
    expect(o2?.[0].label).toBe("Gamma");
  });

  it("toggleValue single", () => {
    expect(toggleValue("single", undefined, "x")).toBe("x");
    expect(toggleValue("single", "y", "x")).toBe("x");
  });

  it("toggleValue multiple", () => {
    expect(toggleValue("multiple", undefined, "x")).toEqual(["x"]);
    expect(toggleValue("multiple", ["x"], "x")).toEqual([]);
    expect(toggleValue("multiple", ["x"], "y")).toEqual(["x", "y"]);
  });
});
