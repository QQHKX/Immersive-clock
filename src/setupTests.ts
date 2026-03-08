import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

  const win = globalThis as unknown as Window & typeof globalThis;

  if (!("matchMedia" in win)) {
    Object.defineProperty(win, "matchMedia", {
      writable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  const raf = (callback: FrameRequestCallback): number =>
    win.setTimeout(() => callback(win.performance.now()), 16);
  const caf = (id: number): void => {
    win.clearTimeout(id);
  };

  if (typeof win.requestAnimationFrame !== "function") {
    Object.defineProperty(win, "requestAnimationFrame", { writable: true, value: raf });
  }
  if (typeof win.cancelAnimationFrame !== "function") {
    Object.defineProperty(win, "cancelAnimationFrame", { writable: true, value: caf });
  }

  if (typeof globalThis.requestAnimationFrame !== "function") {
    Object.defineProperty(globalThis, "requestAnimationFrame", { writable: true, value: raf });
  }
  if (typeof globalThis.cancelAnimationFrame !== "function") {
    Object.defineProperty(globalThis, "cancelAnimationFrame", { writable: true, value: caf });
  }
}

setupTestingEnvironment();
