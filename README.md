<h1 align="center">
  <br/>
  <img src="public/favicon.svg" width="160" height="160" alt="Immersive Clock Logo" />
  <br/>
  沉浸式时钟 | Immersive Clock ⏰
</h1>

<p align="center">
  <a href="https://qqhkx.com">官网</a> ｜ <a href="https://github.com/QQHKX/immersive-clock">GitHub</a> ｜ <a href="https://clock.qqhkx.com">在线体验</a> ｜ <a href="https://qm.qq.com/q/fawykipRhm">QQ 交流群</a>
</p>

<p align="center">
  简体中文 ｜ <a href="./README.en-US.md">English</a>
</p>

<div align="center">

[![](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![](https://img.shields.io/badge/TypeScript-4.9.3-blue.svg)](https://www.typescriptlang.org/)
[![](https://img.shields.io/badge/Vite-4.1.0-646CFF.svg)](https://vitejs.dev/)
[![](https://img.shields.io/badge/PWA-enabled-5A0FC8.svg)](https://web.dev/progressive-web-apps/)

</div>

<div align="center">
  <strong>让时间管理更优雅，让学习更专注</strong>
</div>

---

## 📑 目录

- [项目概述](#项目概述)
- [主要功能](#主要功能)
- [安装与运行](#安装与运行)
- [使用说明](#使用说明)
- [配置与缓存](#配置与缓存)
- [部署](#部署)
- [无障碍支持](#无障碍支持)
- [目录结构](#目录结构)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)
- [许可证与作者](#许可证与作者)
- [Star 历史](#star-历史)

---

## 🕒 项目概述

**沉浸式时钟（Immersive Clock）** 是一款基于 **React + TypeScript + Vite** 构建的轻量化桌面 / 网页时钟应用。  
支持时钟、倒计时、秒表与自习模式，内置天气、噪音监测、励志语录、课程表管理、公告与更新日志弹窗等实用功能。  
通过 PWA，可离线使用并自动更新缓存。

> 适用场景：校园自习、专注学习、番茄钟、演示看板、桌面时钟等。

# 🌠 界面预览

![](docs/demo/极简界面.jpeg)

![](docs/demo/模式选择.jpeg)

![](docs/demo/倒计时功能.jpeg)

![](docs/demo/自习功能.jpeg)

![](docs/demo/公告-更新日志弹窗.jpeg)

## 💡 主要功能

### 🧭 时间管理模式

- **时钟 / 倒计时 / 秒表 / 自习** 模式自由切换
- **HUD 智能控制层**：点击或按键显示，约 8 秒自动隐藏

### 📚 学习辅助看板

- 天气展示与手动刷新
- 噪音监测：麦克风校准、基线调整、报告与历史记录
- 励志语录：频道管理与刷新间隔设置
- 目标年份倒计时（如高考倒计时）

### 🚀 性能与体验

- 静态资源分类型缓存（图片 / 字体 / 音频）
- PWA 支持：离线缓存、自动更新、桌面安装
- 无障碍（ARIA）与快捷键支持（`Space / Enter` 唤出 HUD）

---

## 🧩 安装与运行

要求：Node.js ≥ 16（推荐 18+），npm ≥ 8

### Web 版本

```bash
# 复制 .env 并添加环境变量
copy .env.example .env

# 安装依赖
npm install

# 启动开发环境（默认端口 3005）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### Electron 桌面版

```bash
# 复制 .env 并添加环境变量
cp .env.example .env

# 安装依赖（包含 Electron）
npm install

# 启动 Electron 开发环境
npm run dev:electron

# 构建桌面应用
npm run build:electron
```

📦 构建完成后，安装包将输出到 `release` 目录。详细说明请参考 [ELECTRON.md](ELECTRON.md)

---

## 📘 使用说明

- **模式切换**：点击页面或按 `Space/Enter` 唤出 HUD
- **倒计时**：双击时间进入设置，支持预设时间与提示音
- **秒表**：启动、暂停、累计记录
- **自习模式**：展示天气、噪音监测、语录与目标年份倒计时
- **设置面板**：调整目标年份、噪音基线、语录刷新间隔、课程表

详细说明请见：

- [使用说明（中文）](docs/usage.zh-CN.md)
- [Usage Guide (English)](docs/usage.en-US.md)
- [常见问题（中文）](docs/faq.zh-CN.md)
- [FAQ (English)](docs/faq.en-US.md)

---

## 🔧 配置与缓存

- 环境变量
  - `VITE_APP_VERSION`：指定版本号（默认读取 `package.json`）

- 缓存策略
  - 图片/字体/音频：`CacheFirst`
  - 文档：`NetworkFirst`
  - 忽略版本参数 `v`，优化离线体验

---

## ☁️ 部署

```bash
# 构建后将 dist 目录上传到任意静态托管平台
# 例如：Vercel / Netlify / GitHub Pages
```

建议使用 HTTPS 以获得完整 PWA 功能。
已提供 `vercel.json` 可直接导入部署。

---

## ♿ 无障碍支持

| 操作            | 功能           |
| --------------- | -------------- |
| `Space / Enter` | 显示 HUD       |
| `Enter / Esc`   | 确认或关闭模态 |
| 双击时间        | 打开倒计时设置 |
| 触摸双击        | 移动端交互支持 |

---

## 🗂️ 目录结构

```text
immersive-clock/
├── public/            # 静态资源（图标、音频、PWA manifest、文档等）
├── src/               # 源码（组件、样式、hooks、utils 等）
│  ├── components/     # 功能组件与界面元素
│  ├── hooks/          # 自定义 Hook（计时、全屏、音频）
│  ├── utils/          # 工具与本地存储管理
│  ├── styles/         # 全局与变量样式
│  └── pages/          # 页面
├── docs/              # 使用说明与 FAQ
├── scripts/           # 构建后处理脚本（站点地图日期等）
├── vite.config.ts     # Vite 配置（含 PWA 与版本注入）
└── package.json       # 项目元数据与脚本
```

---

## ❓ 常见问题

- 无法定位城市？检查浏览器定位授权或使用手动刷新。
- 噪音监测无数据？确认已授权麦克风且设备支持。
- HUD 未出现？确保未打开模态框，点击页面或按 `Space/Enter`。
- 如何查看公告与更新日志？点击右下角版本号或在菜单中打开弹窗。

更多问题与解答请查看 [docs/faq.zh-CN.md](docs/faq.zh-CN.md)。

---

## 💬 交流与反馈

欢迎加入我们的官方交流群，分享使用心得、反馈 Bug 或提出功能建议。

|   QQ 交流群   |                                     二维码                                      |
| :-----------: | :-----------------------------------------------------------------------------: |
| **965931796** | <img src="public\assets\qq-group.png.jpg" width="200" alt="QQ Group QR Code" /> |

---

## 🤝 贡献指南

欢迎任何形式的贡献（功能优化、Bug 修复、文档改进等）：

1. Fork 仓库并创建分支
2. 保持代码风格一致、变更最小
3. 提交 PR 并附带简要说明与截图
4. 问题反馈与建议请至 [Issues](https://github.com/QQHKX/immersive-clock/issues)

---

## 📄 许可证与作者

- 许可证：MIT
- 作者：**QQHKX**
  - 🌐 [个人网站](https://qqhkx.com)
  - 💻 [GitHub](https://github.com/QQHKX)

---

## ⭐️ Star 历史

<div align="center">
  <a href="https://star-history.com/#QQHKX/Immersive-clock" target="_blank">
    <img src="https://api.star-history.com/svg?repos=QQHKX/Immersive-clock&type=Date" alt="Star History Chart" />
  </a>
</div>
