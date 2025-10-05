<div align="right">
  <details>
    <summary>🌐 Language</summary>
    <div>
      <div align="right">
        <p>中文（默认）</p>
        <p><a href="#">English (coming soon)</a></p>
      </div>
    </div>
  </details>
</div>

<h1 align="center">
  <br/>
  <img src="public\favicon.svg" width="200" height="200" alt="Immersive Clock Banner" />
  <br/>
  沉浸式时钟 ⏰
</h1>

<p align="center">
  <a href="https://qqhkx.com">官网</a> ｜ <a href="https://github.com/QQHKX/immersive-clock">GitHub</a>
</p>

<div align="center">

[![](https://img.shields.io/badge/version-3.6.0-blue.svg)](https://github.com/QQHKX/immersive-clock)
[![](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![](https://img.shields.io/badge/TypeScript-4.9.3-blue.svg)](https://www.typescriptlang.org/)
[![](https://img.shields.io/badge/Vite-4.1.0-646CFF.svg)](https://vitejs.dev/)
[![](https://img.shields.io/badge/PWA-enabled-5A0FC8.svg)](https://web.dev/progressive-web-apps/)

</div>

<div align="center">
  <strong>让时间管理更优雅，让学习更专注</strong>
</div>

# 🌟 项目概述
沉浸式时钟是基于 React + TypeScript + Vite 构建的轻量化桌面/网页时钟应用。它支持多种时间管理模式（时钟、倒计时、秒表、晚自习），并内置天气展示、噪音监测、励志金句、课程表管理、公告与更新日志弹窗等实用功能。通过 PWA 能力，应用可离线使用，并在新版本发布时自动更新缓存。

适用场景：校园晚自习、专注学习、番茄钟辅助、演示与看板、日常桌面时钟等。

# 🌠 界面预览（Screenshots）

![](docs/demo/极简界面.jpeg)

![](docs/demo/模式选择.jpeg)

![](docs/demo/倒计时功能.jpeg)

![](docs/demo/晚自习功能.jpeg)

![](docs/demo/公告-更新日志弹窗.jpeg)

# 🌟 关键特性（Key Features）
1. **时间管理模式**
   - 时钟、倒计时、秒表、晚自习模式自由切换
   - HUD 智能显示：点击或按键唤出控制层，8 秒自动隐藏

2. **学习辅助看板**
   - 目标年份倒计时（如高考年度）
   - 天气信息展示与手动刷新
   - 噪音监测：麦克风校准与基线滑动调整
   - 励志金句频道管理与自动刷新间隔设置

3. **可配置与持久化**
   - 课程表管理：添加/编辑/删除时段，本地存储持久化
   - 公告与更新日志弹窗：读取 `public/docs/*.md`
   - PWA 支持：离线缓存、自动更新、可安装到桌面/主屏

4. **性能与体验**
   - 代码分割与静态资源按类型缓存
   - 独立图片/字体/音频缓存策略
   - 细节优化与语义化可访问性

# 🚀 安装与构建（Getting Started）
环境要求：Node.js 16+（推荐 18+），npm 8+

安装依赖：

```bash
npm install
```

本地开发（默认端口 `3005`，自动打开浏览器）：

```bash
npm run dev
```

生产构建（输出目录：`dist`）：

```bash
npm run build
```

本地预览生产构建：

```bash
npm run preview
```

# 📘 使用说明（Usage）
**模式切换与 HUD**
- 点击页面或按下 `Space/Enter` 唤出 HUD，约 8 秒自动隐藏
- 在 HUD 内选择：时钟 / 倒计时 / 秒表 / 晚自习模式

**倒计时（Countdown）**
- 双击时间显示（或触摸设备自定义双击）打开设置模态
- 支持小时/分钟/秒设置与多个预设（10 分钟、30 分钟、1 小时等）
- 键盘：`Enter` 确认、`Esc` 关闭；结束播放提示音（`public/ding.mp3`）

**秒表（Stopwatch）**
- 启动、暂停与累计时长，简洁直观

**晚自习模式（Study）**
- 左侧：天气与噪音监测（需授权麦克风）
- 右侧：目标年份倒计时与励志金句
- 中央：当前时间大字显示，适合投屏

**设置面板（Settings）**（晚自习模式下显示）
- 目标年份、课程表管理、励志金句刷新间隔、噪音基线与校准、天气刷新

# 🔧 配置与环境变量（Config）
- `VITE_APP_VERSION`：可通过环境变量指定应用版本；未提供时读取 `package.json.version`
- 开发服务器端口：`3005`（见 `vite.config.ts`）
- PWA：由 `vite-plugin-pwa` 配置，复用 `public/manifest.json`

# 🗃️ 数据与缓存（Data & Cache）
- 本地存储：
  - `studySchedule`：课程表数据
  - `noise-monitor-baseline`：噪音监测基线值（dB）
- PWA 缓存策略：
  - 图片/字体/音频采用独立 CacheFirst 策略
  - 文档（`/docs/*.md`）采用 NetworkFirst
  - 忽略版本参数 `v`，兼容版本缓存策略与离线导航

# ♿ 无障碍与快捷键（Accessibility）
- `Space/Enter`：显示 HUD 控制层
- 倒计时模态：`Enter` 确认、`Esc` 关闭
- 触摸设备：支持自定义双击识别打开倒计时设置
- 主界面提供语义化 ARIA 属性（如 `role="main"`）

# ☁️ 部署建议（Deploy）
- 将 `dist` 发布至任意静态托管（Netlify、Vercel、GitHub Pages 等）
- 提供 `vercel.json` 可直接导入部署
- 建议使用 HTTPS 以提升 PWA 体验

# 📝 Roadmap（规划）
- 番茄工作法模式与自定义番茄区间
- 噪音监测可视化图表与历史记录
- 国际化（i18n）与多语言界面
- 自定义主题与皮肤（可选）

# 🤝 贡献（Contributing）
欢迎为本项目贡献！
- 提交功能改进或性能优化 PR
- 修复缺陷并完善交互细节
- 改进文档与示例，帮助更多用户上手

建议流程：
- Fork 仓库并创建功能分支
- 保持代码风格一致与变更最小化
- 提交 PR 并说明变更动机与截图

# 📄 许可证与作者（License & Author）
- 许可证：MIT，详情请参阅 [LICENSE](LICENSE)
- 作者：**QQHKX** — [个人网站](https://qqhkx.com) ｜ [GitHub](https://github.com/QQHKX)

# 📊 GitHub 统计（GitHub Stats）
<div align="center">
  <a href="https://github.com/QQHKX" target="_blank" rel="noopener noreferrer">
    <img src="https://github-readme-stats.vercel.app/api?username=QQHKX&show_icons=true&rank_icon=github&theme=radical" alt="GitHub Stats" />
  </a>
  <br/>
  <a href="https://github.com/QQHKX" target="_blank" rel="noopener noreferrer">
    <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=QQHKX&layout=compact&langs_count=8&theme=radical" alt="Top Languages" />
  </a>
</div>

# ⭐️ Star 历史（Star History）
<div align="center">
  <a href="https://star-history.com/#QQHKX/Immersive-clock" target="_blank" rel="noopener noreferrer">
    <img src="https://api.star-history.com/svg?repos=QQHKX/Immersive-clock&type=Date" alt="Immersive-clock Star History Chart" />
  </a>
  <br/>
</div>