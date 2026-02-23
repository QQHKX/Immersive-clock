# AI 编码助手开发指南

本文档为在沉浸式时钟项目中工作的 AI 编码助手提供开发指南。

## 项目概述

**沉浸式时钟** 是一个基于 React 18 + TypeScript 5 + Vite 4 构建的轻量级时钟应用。支持时钟、倒计时、秒表和自习模式，具有天气监测、噪音分析、励志语录和多目标倒计时轮播等功能。

**技术栈：**

- React 18.2.0 + TypeScript 5.4.0 + React Router 6
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

- 单元测试：`src/**/__tests__/*.test.ts(x)` 或同目录 `*.test.ts`
- 端到端测试：`tests/e2e/*.e2e.spec.ts`

---

## 项目架构与核心机制

### 目录结构与职责

| 目录/文件              | 角色       | 关键职责                                                                     |
| ---------------------- | ---------- | ---------------------------------------------------------------------------- |
| `electron/`            | 桌面端核心 | `main.ts`(主进程/协议/权限), `preload.ts`(预加载)                            |
| `src/main.tsx`         | Web 入口   | 应用挂载、PWA Service Worker 注册                                            |
| `src/App.tsx`          | 路由容器   | 路由配置、全局公告弹窗容器                                                   |
| `src/pages/ClockPage/` | 主控页面   | 模式切换逻辑、全局弹窗堆叠管理、HUD 显隐控制                                 |
| `src/contexts/`        | 状态核心   | `AppContext`(运行时状态), `appReducer`(状态转换逻辑)                         |
| `src/components/`      | UI 组件库  | `Modal`(统一模态), `FormComponents`, `LightControls`                         |
| `src/hooks/`           | 逻辑复用   | `useTimer`(高精度计时), `useAudio`(音效), `useBattery`                       |
| `src/utils/`           | 工具与服务 | `appSettings.ts`(配置管理), `timeSync.ts`(校时), `noiseDataService.ts`(噪音) |

### 关键 Utils 模块

- **`appSettings.ts`**: 统一配置管理中心（CRUD/持久化）
- **`timeSync.ts`**: 网络校时与本地偏移管理，统一"当前时间"来源
- **`noiseDataService.ts`**: 噪音采集、存储 (LocalStorage) 与事件分发
- **`db.ts`**: IndexedDB 封装，用于存储大体积数据（如自定义字体）
- **`announcementStorage.ts`**: 公告版本控制与已读状态管理

### 混合应用架构（Electron + PWA）

项目同时支持 Web (PWA) 和 Desktop (Electron) 运行模式。

**Electron 集成：**

- 协议：注册 `app://` 自定义协议加载本地资源，支持 SPA 路由
- 权限：自动允许 `geolocation`；`media` 权限仅允许音频采集（拒绝视频以防隐私泄露）
- 安全：拦截非 `app://` 和非开发服务器的导航请求

**PWA：**

- 集成 `vite-plugin-pwa`，提供离线缓存与桌面安装能力
- 离线策略：核心静态资源采用 CacheFirst；文档（`/docs/*.md`）采用 NetworkFirst 并设定 24 小时过期

### 噪音监测系统

- **数据流**：Web Audio API (AudioContext) -> 实时 RMS/dB 计算 -> `noiseDataService`
- **存储策略**：采用**滑动窗口**机制，在 `localStorage` 中存储最近 24 小时的样本 (`NoiseSample[]`)
- **解耦设计**：采集服务与 UI 完全解耦，通过 `window.dispatchEvent` 触发 `noise-samples-updated` 事件驱动图表更新
- **提示音提醒**：当平均 dB 超过阈值且在设置中开启时播放提示音（默认关闭）

### 事件总线

组件间解耦通信依赖自定义事件 (`window.dispatchEvent`)。

| 事件名                  | 触发源                 | 监听者          | 作用                           |
| ----------------------- | ---------------------- | --------------- | ------------------------------ |
| `settingsSaved`         | SettingsPanel          | 业务组件        | 通知配置已变更（如刷新语录源） |
| `noise-samples-updated` | noiseDataService       | NoiseChart      | 通知噪音历史数据已更新         |
| `timeSync:syncNow`      | SettingsPanel/用户操作 | timeSync 管理器 | 触发一次立即校时               |
| `timeSync:updated`      | timeSync 管理器        | SettingsPanel   | 通知校时状态已更新（刷新显示） |
| `storage`               | 浏览器                 | AppContext      | 多标签页状态同步（部分实现）   |

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
- **避免使用 `any`**（警告级别）- 使用适当的类型或 `unknown`
- 对象形状使用接口，联合类型/基本类型使用类型
- **禁止单字母变量**，使用有语义的变量名

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
- 使用 CSS Modules 进行样式处理（`.module.css`），CSS 变量位于 `src/styles/variables.css`
- 添加 `aria-*` 属性以提高无障碍性
- 使用语义化 HTML（`main`、`section` 等）

**状态管理：**

- 通过 Context + Reducer 管理全局状态（`src/contexts/AppContext.tsx`）
- 运行时状态与持久化配置分离：
  - **运行时状态**：AppContext + Reducer（模式切换、倒计时运行等）
  - **持久化配置**：`appSettings.ts`（用户偏好设置）
- 动作在 `src/types/index.ts` 中定义为可辨识联合类型

### UI 组件规范

**表单与按钮统一：**

优先使用 `src/components/FormComponents` 下的统一组件：

- **按钮**：`FormButton`（支持 `variant`、`size`、`icon`、`loading`）
- **输入**：`FormInput`（支持 `variant="time"/"number"`）、复选框：`FormCheckbox`、单选：`FormRadio`、分段选择：`FormSegmented`

**按钮变体规范：**

- `primary`：主行动或确认（如模态框确认）
- `secondary`：一般次级操作
- `danger`：不可逆或破坏性操作
- `success`：正向结果或成功动作
- `ghost`（透明）：用于底部控制栏与工具栏等非强调操作，去除背景与边框，仅保留轻微悬浮动效；**不要用于主行动按钮**

**尺寸规范：** `sm`/`md`/`lg`，底部控制栏与工具栏默认使用 `sm`

**非表单控件：**

为非表单类按钮（如 `Tabs`、`ModeSelector`）使用 `src/components/LightControls/LightButton` 进行轻量封装：

- `Tabs`：`role="tablist"`，按钮 `role="tab"` 与 `aria-selected`
- 工具栏：容器 `role="toolbar"`，图标按钮提供 `aria-label`

**设置面板 UI 规范：**

- 使用 `FormSection` 组件进行内容分组（**禁止**裸写 `div` 作为主要分组容器）
- 使用 `FormRow` 组件进行水平排列（`gap="sm"` 或 `gap="md"`，`align="center"`）
- **禁止**在子页面内部使用 `h1`, `h2`, `h3` 等标题标签作为页面主标题（页面标题由父级 Tabs 负责）
- 子页面内部仅使用 `FormSection` 的 `title` 属性作为区块标题
- 说明文本：使用 `p` 标签配合 `className={styles.helpText}`
- 状态信息：使用 `p` 标签配合 `className={styles.infoText}`

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

## 数据持久化规范

### 存储分层选择

**1) AppSettings（首选：用户偏好/配置）**

- 适用：设置面板可编辑、需要长期持久化、需要类型约束的配置
- 位置：`src/utils/appSettings.ts`
- 要求：
  - 新增字段必须在 `AppSettings` 接口与默认值 `DEFAULT_SETTINGS` 中补齐
  - 更新必须通过 `updateAppSettings / updateStudySettings / updateGeneralSettings / updateNoiseSettings / updateTimeSyncSettings` 等封装写入

**2) localStorage（轻量缓存/分片数据）**

- 适用：非关键配置、可重建/可过期的数据（如天气缓存、噪音采样、按日分片的报告）
- 推荐做法：
  - 使用独立的 `src/utils/*Storage.ts` 或 `src/utils/*Service.ts` 管理读写与校验
  - 对可过期数据提供清理策略函数（例如：噪音切片摘要 `noise-slices` 保存天数可配置，默认 14 天，并以本地容量的 90% 为上限自动裁剪）

**3) IndexedDB（大体积/二进制/文件）**

- 适用：字体文件、Blob、体积较大的结构化数据
- 位置：`src/utils/db.ts`，以及具体业务封装（如 `src/utils/studyFontStorage.ts`）

### 键名与结构约定

- **统一入口**：配置类优先进入 `AppSettings`，避免新增散落的 localStorage 配置键
- **命名要求**：
  - localStorage 键必须"可读 + 可归类"，避免短、泛、无前缀的键名
  - 动态键必须有固定前缀，例如：`weather-cache.<YYYY-MM-DD>`
- **类型与校验**：
  - 读取 localStorage 时必须做 `JSON.parse` try/catch，并校验结构（数组/字段类型等）
  - 读取 AppSettings 时可依赖 `getAppSettings()` 的默认值合并

### 迁移与兼容策略

- **先迁移再清理**：旧键数据必须先迁入新体系（通常为 AppSettings 或新键），验证成功后才能删除旧键
- **禁止误清理**：仍可能被读取/写入的键 **不得** 放入 `LEGACY_KEYS`
- **迁移应尽量幂等**：多次执行不应破坏数据
- 推荐迁移流程：
  1. 在 `src/utils/storageInitializer.ts` 中新增迁移逻辑
  2. 迁移条件建议使用"raw AppSettings 中是否显式存在对应字段"判断
  3. 迁移成功后删除旧键（`removeItem`）
  4. 旧键确认不再被任何代码路径读取后，才加入 `LEGACY_KEYS`
  5. 为迁移增加 Vitest 单测覆盖典型场景

---

## 测试指南

### 测试策略

- **优先写 Vitest 单测**：当新增/修改逻辑函数、数据处理、格式化、存储迁移、网络请求封装等"纯逻辑"能力
- **组件级测试用 Vitest + Testing Library**：验证组件的渲染/受控输入/按钮点击等局部交互
- **优先写 Playwright E2E**：当新增/修改用户可见行为（交互、键盘/触控、设置面板联动、页面跳转、渲染结果）或需要依赖浏览器能力（布局、焦点、事件、媒体、PWA 等）
- **回归修复必须补测试**：修复 bug 时，优先补一个能稳定复现旧问题的用例（先红后绿）

### Vitest 单元测试

**运行：**

```bash
npm run test                # 运行所有单测
npm test -- path/to/file    # 运行单个测试文件
npm run test:coverage       # 生成覆盖率报告
```

**编写规范：**

- 采用 **AAA**（Arrange/Act/Assert）结构：准备 → 执行 → 断言
- 每个用例只验证一个核心行为；复杂场景拆成多个 `it`
- 避免脆弱断言（如依赖随机数、当前时间、网络波动）
- 模块 mock 使用 `vi.mock()`，并在 `beforeEach/afterEach` 中重置
- 异步测试优先用 `await` 明确等待

**覆盖率期望：**

- `src/utils/**/*`、`src/services/**/*`、`src/hooks/**/*`
- 阈值：lines/functions/statements 80%，branches 70%

### Playwright 端到端测试

**运行：**

```bash
npm run test:e2e            # 运行所有 E2E
npm run test:e2e -- tests/e2e/clock.e2e.spec.ts  # 运行单个测试
```

**编写规范：**

- 默认启动 `npm run dev`，baseURL 为 `http://127.0.0.1:3005`
- 选择器稳定性优先：优先使用语义化定位（如 `getByRole`、可访问名称）
- 每个用例只覆盖一个关键用户路径；复杂流程拆成多个用例

**本地开发：**

- 默认使用系统 Edge（避免自动下载 Playwright 浏览器）
- 可视化运行：`npm run test:e2e -- --headed`
- 如需使用 chromium/firefox/webkit，设置 `PW_BUNDLED_BROWSERS=1` 后运行

### 测试地图

项目维护了测试地图 `docs/testing-map.md`，用于快速定位"功能 → 用例"。新增/修改功能并新增/调整用例时，请同步更新测试地图。

---

## 常用模式

### 配置管理

```typescript
import { getAppSettings, updateStudySettings } from "@/utils/appSettings";

// 读取配置
const settings = getAppSettings();

// 局部更新
updateStudySettings({ targetYear: 2026 });
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

### 高精度计时器

```typescript
import { useTimer } from "@/hooks/useTimer";

const callback = useCallback(() => {
  // 每次触发的逻辑
}, []);

useTimer(callback, isActive, 1000); // 1秒间隔
```

---

## 重要注意事项

1. **禁止 console.log：** 使用 `logger` 工具（ESLint 强制执行）
2. **JSX 中导入 React：** 不需要（React 18 自动支持）
3. **导入排序：** 关键 - 使用 `npm run lint:fix` 自动修复
4. **未使用变量：** 加 `_` 前缀或修复（警告级别）
5. **PWA 缓存：** 版本缓存插件处理资源版本化（`?v=<version>`）
6. **Electron 模式：** 使用 `--mode electron` 进行 Electron 构建
7. **避免使用 `any`：** TypeScript 优先，使用适当的类型或 `unknown`
8. **禁止单字母变量：** 使用有语义的变量名
9. **AGENTS.md 同步：** 任何涉及项目架构、技术规范或核心逻辑的变更，**必须**同步更新 `AGENTS.md` 中的对应章节

---

## 环境变量与缓存配置

### 环境变量

从 `.env.example` 创建 `.env`：

```bash
VITE_APP_VERSION=3.12.4  # 如未设置，自动从 package.json 读取
```

**版本注入：**

- 运行时版本：通过 `import.meta.env.VITE_APP_VERSION` 注入
- Manifest 统一：`index.html` 使用 `<link rel="manifest" href="/manifest.json" />`
- 参数注入：页面链接的 `manifest.json`、`.webmanifest` 及 `favicon.svg` 均追加 `?v=<version>`

### 缓存策略

项目使用 `vite-plugin-pwa` 提供 PWA 缓存能力，缓存策略如下：

- **静态资源**（图片、字体、音频）：`CacheFirst` - 优先使用缓存，适合不常变化的资源
- **文档**（`/docs/*.md`）：`NetworkFirst` - 优先从网络获取，失败时使用缓存，并设定 24 小时过期
- **版本控制**：忽略版本参数 `v`，优化离线体验

---

## 部署

### 静态托管部署（推荐）

#### 🚀 Vercel

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/QQHKX/immersive-clock)

#### ☁️ EdgeOne Pages

[![Deploy with EdgeOne Pages](https://camo.githubusercontent.com/823c1cff835803f4f496377113449241c418079a84ba67a789068e643b74cb73/68747470733a2f2f63646e7374617469632e74656e63656e7463732e636f6d2f656467656f6e652f70616765732f6465706c6f792e737667)](https://edgeone.ai/pages/new?repository-url=https://github.com/QQHKX/immersive-clock)

> 建议使用 HTTPS 以获得完整 PWA 功能。

### Docker 部署

项目提供了 Dockerfile，可通过 Docker 快速部署：

```bash
# 构建镜像
docker build -t immersive-clock .

# 运行容器
docker run -d -p 8080:80 --name immersive-clock-app immersive-clock
```

或使用预构建的镜像：

```bash
# 运行容器
docker run -d -p 8080:80 --name immersive-clock-app ghcr.io/QQHKX/immersive-clock:latest
```

访问 http://localhost:8080 即可。

**可选：使用 docker-compose**

```yaml
version: "3.8"
services:
  immersive-clock:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
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
| 本地开发可视化测试 | `npm run test:e2e -- --headed`                        |

---

**详细使用说明请参阅：**

- [README.md](README.md) - 完整项目文档
- [docs/usage.zh-CN.md](docs/usage.zh-CN.md) - 用户指南（中文）
- [docs/faq.zh-CN.md](docs/faq.zh-CN.md) - 常见问题（中文）
- [docs/testing-map.md](docs/testing-map.md) - 测试地图
