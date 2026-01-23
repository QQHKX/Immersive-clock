import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * 初始化测试运行环境（函数级注释）：
 * - 注册 @testing-library/jest-dom 的断言扩展
 * - 每个用例结束后自动 cleanup，避免 DOM 泄漏影响后续用例
 * - 补齐 jsdom 下常见缺失的浏览器 API（如 matchMedia）
 */
function setupTestingEnvironment() {
  afterEach(() => {
    cleanup();
  });

  if (!("matchMedia" in window)) {
    window.matchMedia = ((query: string) => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    }) as unknown as typeof window.matchMedia;
  }
}

setupTestingEnvironment();

