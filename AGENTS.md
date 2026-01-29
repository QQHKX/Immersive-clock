# AI 编码助手开发指南

本文档为在沉浸式时钟项目中工作的 AI 编码助手提供开发指南。

## 项目概述

**沉浸式时钟** 是一个基于 React 18 + TypeScript 5 + Vite 4 构建的轻量级时钟应用。支持时钟、倒计时、秒表和自习模式，具有天气监测、噪音分析、励志语录和多目标倒计时轮播等功能。

**技术栈：**

- React 18.2.0 + TypeScript 5.4.0
- Vite 4.1.0 构建工具
- PWA 支持（vite-plugin-pwa）
- Electron 桌面应用支持
- 测试：Vitest（单元测试）+ Playwright（端到端测试）

---

## 构建、检查和测试命令

### 开发

```bash
npm run dev                 # 启动 Web 开发服务器 (http://localhost:3005)
npm run dev:electron        # 启动 Electron 开发环境
```

### 构建

```bash
npm run build               # 构建 Web 版本
npm run build:electron      # 构建 Electron 版本
npm run dist:electron       # 构建并打包 Electron 安装包
npm run preview             # 预览生产构建
```

### 代码检查和格式化

```bash
npm run lint                # 对 src 目录运行 ESLint
npm run lint:fix            # 自动修复 ESLint 问题
npm run format              # 使用 Prettier 格式化代码
```

### 测试

**单元测试（Vitest）：**

```bash
npm run test                # 运行所有单元测试
npm test -- path/to/file    # 运行单个测试文件
npm test -- -t "测试名称"   # 运行匹配模式的测试
npm run test:coverage       # 运行测试并生成覆盖率报告
```

**端到端测试（Playwright）：**

```bash
npm run test:e2e:install    # 安装 Playwright 浏览器
npm run test:e2e            # 运行端到端测试（自动启动开发服务器）
npx playwright test --ui    # 使用 Playwright UI 运行
npx playwright test tests/e2e/clock.e2e.spec.ts  # 运行单个测试
```

**测试文件位置：**

- 单元测试：`src/**/__tests__/*.test.ts(x)`
- 端到端测试：`tests/e2e/*.e2e.spec.ts`

---

## 代码风格指南

### 导入顺序

**关键：** 导入必须遵循 ESLint 的严格字母排序规则，并在组之间留空行：

```typescript
import React, { useState, useCallback } from "react";

import { useTimer } from "../../hooks/useTimer";
import { formatClock } from "../../utils/formatTime";
import { getAdjustedDate } from "../../utils/timeSync";

import styles from "./Clock.module.css";
```

**规则：**

1. React 导入在最前面
2. 空一行
3. 本地导入（按字母顺序排序，不区分大小写）
4. 空一行
5. 样式/资源导入在最后
6. 工具函数使用解构导入
7. 组件使用默认导入

### TypeScript

**类型定义：**

- 在 `src/types/index.ts` 中定义所有类型，或使用同目录下的 `.d.ts` 文件
- 公共函数使用显式返回类型
- 使用严格 TypeScript（tsconfig 中 `strict: true`）
- 避免使用 `any`（警告级别）- 使用适当的类型或 `unknown`
- 对象形状使用接口，联合类型/基本类型使用类型

**命名约定：**

- 类型/接口：PascalCase（如 `AppState`、`CountdownItem`）
- 函数：camelCase（如 `formatClock`、`useTimer`）
- 组件：PascalCase（如 `Clock`、`CountdownModal`）
- 常量：UPPER_SNAKE_CASE（如 `HITOKOTO_CATEGORIES`）
- 私有/未使用变量：加 `_` 前缀以避免警告

### 注释和文档

**为所有导出函数、类型和组件使用 JSDoc 注释：**

```typescript
/**
 * 高精度计时器钩子
 * 使用 requestAnimationFrame 实现平滑的计时器更新
 * @param callback 每次计时器触发时执行的回调函数
 * @param isActive 计时器是否激活
 * @param interval 计时器间隔（毫秒），默认为 1000ms
 */
export function useTimer(callback: () => void, isActive: boolean, interval: number = 1000): void {
  // 实现...
}
```

**文件级注释：**

```typescript
/**
 * 统一日志工具
 * 开发环境输出全部级别；生产环境仅保留 warn/error。
 */
```

**行内注释（中文）：** 按项目约定，行内实现注释使用中文。

### React 模式

**Hooks：**

- 自定义 Hook 放在 `src/hooks/` 目录，使用 `use` 前缀
- 始终正确定义回调依赖项
- 将作为 props 传递的昂贵函数使用 `useCallback` 包裹
- 使用 `useRef` 保持跨渲染的稳定引用

**组件：**

- 仅使用函数式组件（不使用类组件）
- 导出命名函数：`export function Clock() { ... }`
- 使用 CSS Modules 进行样式处理（`.module.css`）
- 添加 `aria-*` 属性以提高无障碍性
- 使用语义化 HTML（`main`、`section` 等）

**状态管理：**

- 通过 Context + Reducer 管理全局状态（`src/contexts/AppContext.tsx`）
- 动作在 `src/types/index.ts` 中定义为可辨识联合类型
- 本地存储工具在 `src/utils/` 目录

### 错误处理

```typescript
try {
  // 操作
} catch (error) {
  logger.error("描述性消息:", error);
  // 优雅降级
}
```

- 使用 `src/utils/logger.ts` 中的 `logger` 工具
- 绝不在不记录日志的情况下静默错误（警告级别）
- 提供用户友好的错误消息
- 仅在 `allowEmptyCatch: true` 时允许空的 catch 块

### 格式化（Prettier）

```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5",
  "arrowParens": "always"
}
```

**关键点：**

- 字符串使用双引号
- 始终使用分号
- 最大行宽：100 字符
- 2 空格缩进

---

## 测试指南

### 单元测试（Vitest）

**结构：**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { debug, info, warn, error, logger } from "../logger";

describe("logger", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warn 调用 console.warn", () => {
    warn("test");
    expect(warnSpy).toHaveBeenCalled();
  });
});
```

**最佳实践：**

- 全面测试工具函数、服务和 Hook
- React 测试使用 `jsdom` 环境
- 模拟外部 API 和浏览器 API
- 目标覆盖率 80%（vitest.config.ts 中的阈值）

### 端到端测试（Playwright）

**结构：**

```typescript
import { test, expect } from "@playwright/test";

test("首页加载并显示时钟", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/沉浸式时钟/i);

  const main = page.getByRole("main", { name: "时钟应用主界面" });
  await expect(main).toBeVisible();
});
```

**最佳实践：**

- 测试关键用户流程（模式切换、设置持久化）
- 使用语义选择器（role、label）而非 CSS 选择器
- 自动在 http://127.0.0.1:3005 启动开发服务器
- 本地开发在 msedge 运行，CI 中运行 chromium/firefox/webkit

---

## 文件结构和约定

```
src/
├── components/       # UI 组件（Clock、HUD、Modal 等）
├── contexts/         # 全局状态（AppContext with reducer）
├── hooks/            # 自定义 Hook（useTimer、useAudio 等）
├── pages/            # 页面容器
├── services/         # 外部 API 服务（天气等）
├── types/            # TypeScript 类型定义
├── utils/            # 工具函数和存储助手
└── styles/           # 全局 CSS 变量
```

**命名：**

- 组件文件：`ComponentName.tsx` + `ComponentName.module.css`
- 测试文件：`fileName.test.ts`（单元测试）、`fileName.e2e.spec.ts`（端到端测试）
- 桶导出：公共 API 使用 `index.ts`

---

## 常用模式

### 存储

```typescript
// 使用 src/utils/ 中的工具
export function loadSettings(): Settings {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
}
```

### 日志记录

```typescript
import { logger } from "@/utils/logger";

logger.debug("开发信息"); // 仅在开发环境
logger.warn("警告信息"); // 始终记录
logger.error("错误详情", err); // 始终记录
```

### 时间处理

```typescript
import { getAdjustedDate } from "@/utils/timeSync";

const now = getAdjustedDate(); // 使用此方法而非 new Date()
```

---

## 重要注意事项

1. **禁止 console.log：** 使用 `logger` 工具（ESLint 强制执行）
2. **JSX 中导入 React：** 不需要（React 18 自动支持）
3. **导入排序：** 关键 - 使用 `npm run lint:fix` 自动修复
4. **未使用变量：** 加 `_` 前缀或修复（警告级别）
5. **PWA 缓存：** 版本缓存插件处理资源版本控制
6. **Electron 模式：** 使用 `--mode electron` 进行 Electron 构建

---

## 环境变量

从 `.env.example` 创建 `.env`：

```bash
VITE_APP_VERSION=3.12.4  # 如未设置，自动从 package.json 读取
```

---

## 快速参考

| 任务               | 命令                                                  |
| ------------------ | ----------------------------------------------------- |
| 运行单个单元测试   | `npm test -- path/to/file.test.ts`                    |
| 按名称运行测试     | `npm test -- -t "pattern"`                            |
| 运行单个端到端测试 | `npx playwright test tests/e2e/file.e2e.spec.ts`      |
| 修复代码检查问题   | `npm run lint:fix`                                    |
| 覆盖率报告         | `npm run test:coverage`（打开 `coverage/index.html`） |

---

**详细使用说明请参阅：**

- [README.md](README.md) - 完整项目文档
- [docs/usage.zh-CN.md](docs/usage.zh-CN.md) - 用户指南（中文）
- [docs/faq.zh-CN.md](docs/faq.zh-CN.md) - 常见问题（中文）
