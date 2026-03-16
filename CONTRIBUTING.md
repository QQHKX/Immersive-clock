# 贡献指南（CONTRIBUTING）

欢迎你为「沉浸式时钟 / Immersive Clock」贡献代码、文档与想法。本文档面向开发者与贡献者，说明本地开发、提交规范与质量要求。

## 目录

- [贡献方式](#贡献方式)
- [开发前准备](#开发前准备)
- [本地开发](#本地开发)
- [常用命令](#常用命令)
- [分支与提交规范](#分支与提交规范)
- [Pull Request 规范](#pull-request-规范)
- [代码与工程约定](#代码与工程约定)
- [测试与质量门槛](#测试与质量门槛)
- [Electron 构建说明](#electron-构建说明)
- [文档与双语说明](#文档与双语说明)
- [问题反馈与安全](#问题反馈与安全)

---

## 贡献方式

- 修复 Bug（建议先提供可复现步骤/录屏/日志片段）
- 新增或优化功能（建议先开 Issue 讨论实现方向与边界）
- 改进文档（README / docs / 注释说明 / 交互文案）
- 优化性能、可访问性（ARIA / 键盘交互 / 大屏触控体验）

---

## 开发前准备

### 环境要求

- Node.js：`>= 18.0.0`（以 [package.json](./package.json) 的 `engines.node` 为准）
- Git：用于版本控制
- 包管理器：示例命令统一使用 `cnpm`（你也可以使用 npm/pnpm/yarn，但请在 PR 中保持文档示例一致）

### 拉取代码

推荐流程：Fork → Clone 你的 Fork → 添加 upstream（可选）。

```bash
git clone https://github.com/<your-username>/immersive-clock.git
cd immersive-clock
```

### 环境变量

项目提供了示例文件 `.env.example`，本地开发请复制为 `.env`：

```bash
# Windows (PowerShell)
copy .env.example .env
```

如你在 macOS / Linux：

```bash
cp .env.example .env
```

---

## 本地开发

### 安装依赖

```bash
cnpm install
```

### 启动 Web 开发服务器

```bash
cnpm run dev
```

默认开发端口为 `3005`（如需修改请以项目配置为准）。

### 启动 Electron 开发环境

```bash
cnpm run dev:electron
```

---

## 常用命令

以下脚本均定义于 [package.json](./package.json)：

```bash
# Web 端构建 / 预览
cnpm run build
cnpm run preview

# 代码检查与格式化
cnpm run lint
cnpm run lint:fix
cnpm run format

# 单元测试 (Vitest)
cnpm run test
cnpm run test:coverage

# E2E 测试 (Playwright)
cnpm run test:e2e:install
cnpm run test:e2e
```

---

## 分支与提交规范

### 分支命名

建议使用以下格式（示例）：

- `fix/xxx`：Bug 修复
- `feat/xxx`：新功能
- `docs/xxx`：文档
- `refactor/xxx`：重构
- `test/xxx`：测试补充

### 提交信息

- 保持简洁、可读、可追溯，尽量在提交信息中说明“为什么改”和“影响范围”
- 避免混合无关改动（例如一次提交同时做大范围格式化 + 修复逻辑问题）

---

## Pull Request 规范

### 提交前自检

- 变更范围尽量小、目标单一
- 如涉及 UI：提供截图/录屏（尤其是交互与动画变化）
- 如修复 Bug：提供复现步骤与修复前后对比（日志/截图/录屏）
- 如有新增配置项：同步更新 README 或 `docs/` 说明

### PR 描述建议包含

- 改动说明（做了什么）
- 背景与动机（为什么做）
- 风险与兼容性（可能影响哪些场景）
- 测试情况（本地运行了哪些脚本）

---

## 代码与工程约定

### TypeScript 与类型

- TypeScript 优先，避免 `any` 与隐式 `any`
- 类型定义集中在 `src/types/`（如需新增类型，优先在此目录组织）

### 组件与目录

- 通用 UI 组件放在 `src/components/`，按功能语义命名
- 避免单字母变量名（除非约定俗成且作用域极小，例如短循环）

### 样式与设计系统

- 使用 CSS Modules + CSS 变量（令牌位于 `src/styles/variables.css`）
- 关注响应式与触控大屏体验，避免破坏现有布局与交互习惯

### 可访问性

- 交互组件应具备合理的 ARIA 属性与键盘可达性
- 避免仅依赖颜色表达状态；必要时增加文案或图标辅助

---

## 测试与质量门槛

- 单元测试使用 Vitest：尽量为关键逻辑补充覆盖（尤其是修复回归 Bug 时）
- E2E 使用 Playwright：当改动影响核心流程/关键交互时，建议补充或更新用例
- 提交 PR 前建议至少执行：

```bash
cnpm run lint
cnpm run test
```

如涉及页面交互或重大 UI 改动，建议追加：

```bash
cnpm run test:e2e
```

---

## Electron 构建说明

项目提供 Electron 构建脚本：

```bash
cnpm run dist:electron
```

说明：

- 该脚本会先进行 Electron 模式构建，再使用 `electron-builder` 打包产物
- 构建输出目录与平台差异以项目配置为准

---

## 文档与双语说明

- README 面向普通用户；贡献与开发细节应写在本文件
- 用户文档与 FAQ 位于 `docs/`
- 若改动影响中英文 README / docs，请尽量保持双语内容一致（至少保持关键入口与流程一致）

---

## 问题反馈与安全

- 反馈 Bug：请尽量附带复现步骤、截图/录屏、浏览器/系统版本信息
- 安全问题：请不要在公开 Issue/群聊中泄露密钥、Token、个人隐私或可被利用的细节；建议通过作者公开的联系方式进行私下报告
