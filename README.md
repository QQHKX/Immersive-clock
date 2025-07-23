# 沉浸式时钟

一个沉浸式的全屏时钟应用，提供时钟、倒计时和秒表功能，具有现代化UI和流畅的用户体验。支持PWA、性能优化和多平台部署。

![沉浸式时钟](https://via.placeholder.com/800x400?text=沉浸式时钟+截图)

## 在线体验

🌐 [立即体验](https://clock.qqhkx.com/) - 在线网页

## 功能特点

### 核心功能
- **三种模式**：时钟、倒计时、秒表
- **沉浸式界面**：全屏显示，简约现代的设计
- **响应式设计**：适配各种屏幕尺寸，包括移动设备
- **交互式控制**：点击屏幕显示/隐藏控制界面

### 倒计时功能
- 自定义设置时间
- 预设常用时间段
- 结束提示音
- 高精度计时（基于 requestAnimationFrame）

### 秒表功能
- 精确计时
- 里程碑提示
- 高频率更新（10ms 间隔）

### 性能优化
- **智能缓存策略**：基于版本号的缓存控制，版本更新时自动刷新所有资源
- **资源缓存**：字体缓存30天，图片缓存1天，音频缓存2天，CSS/JS文件长期缓存
- **代码分割**：按需加载，减少初始包大小
- **资源压缩**：Gzip/Brotli 压缩，移除生产环境调试代码
- **Microsoft Clarity**：集成用户行为分析，优化用户体验

### 无障碍支持
- 键盘导航
- 高对比度模式
- 减少动画模式

### PWA 支持
- 离线可用
- 可安装到桌面
- 原生应用体验

## 技术栈

### 前端框架
- **React 18** - 现代化的用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **React Router DOM** - 单页应用路由管理

### 构建工具
- **Vite** - 快速的前端构建工具
- **CSS Modules** - 模块化样式管理

### 依赖库
- **React Feather** - 轻量级图标库
- **Microsoft Clarity** - 用户行为分析



## 安装与运行

### 前提条件

- Node.js 14.0+
- npm 或 yarn

### 安装依赖

```bash
npm install
# 或
yarn
```

### 开发模式运行

```bash
npm run dev
# 或
yarn dev
```

### 构建生产版本

```bash
npm run build
# 或
yarn build
```

### 预览生产版本

```bash
npm run preview
# 或
yarn preview
```

## 部署

### Vercel 部署（推荐）

1. **自动部署**：
   - Fork 本仓库到你的 GitHub
   - 在 [Vercel](https://vercel.com) 中导入项目
   - Vercel 会自动检测配置并部署

2. **手动部署**：
   ```bash
   npm install -g vercel
   vercel
   ```

### 其他平台部署

项目包含了多种部署配置文件：
- `vercel.json` - Vercel 部署配置
- `public/.htaccess` - Apache 服务器配置
- `public/_headers` - Netlify 等平台的头部配置

### 环境要求

- Node.js 14.0+
- 支持静态文件托管的平台
- 支持 SPA 路由重写

## 项目结构

```
/
├── public/                   # 静态资源
│   ├── .htaccess            # Apache 服务器配置
│   ├── _headers             # Netlify 头部配置
│   ├── apple-touch-icon.png # iOS 应用图标
│   ├── ding.mp3             # 倒计时结束提示音
│   ├── favicon.svg          # 网站图标
│   ├── manifest.json        # PWA 配置文件
│   └── og-image.png         # 社交媒体分享图片
├── src/
│   ├── components/          # 组件
│   │   ├── AuthorInfo/      # 作者信息组件
│   │   ├── Clock/           # 时钟组件
│   │   ├── ControlBar/      # 控制栏组件
│   │   ├── Countdown/       # 倒计时组件
│   │   ├── CountdownModal/  # 倒计时设置模态框
│   │   ├── HUD/             # 抬头显示控制界面
│   │   ├── ModeSelector/    # 模式选择器
│   │   └── Stopwatch/       # 秒表组件
│   ├── contexts/            # 上下文
│   │   └── AppContext.tsx   # 应用状态管理
│   ├── hooks/               # 自定义钩子
│   │   ├── useAudio.ts      # 音频播放钩子
│   │   ├── useFullscreen.ts # 全屏控制钩子
│   │   └── useTimer.ts      # 高精度计时器钩子
│   ├── pages/               # 页面
│   │   └── ClockPage/       # 主时钟页面
│   ├── styles/              # 全局样式
│   │   ├── global.css       # 全局CSS
│   │   └── variables.css    # CSS变量
│   ├── types/               # 类型定义
│   │   └── index.ts         # 类型声明
│   ├── utils/               # 工具函数
│   │   ├── clarity.ts       # Microsoft Clarity 配置
│   │   ├── formatTime.ts    # 时间格式化
│   │   └── versionCache.ts  # 版本号缓存控制插件
│   ├── App.tsx              # 应用入口组件
│   └── main.tsx             # 应用渲染入口
├── .vercelignore            # Vercel 忽略文件
├── index.html               # HTML模板
├── package.json             # 项目配置
├── robots.txt               # 搜索引擎爬虫配置
├── sitemap.xml              # 网站地图
├── tsconfig.json            # TypeScript配置
├── vercel.json              # Vercel 部署配置
└── vite.config.ts           # Vite构建配置
```

## 使用指南

### 基本操作

- **显示/隐藏控制界面**：点击屏幕任意位置或按空格键
- **切换模式**：点击顶部的模式选择器
- **全屏切换**：点击控制栏中的全屏按钮

### 倒计时模式

- **设置时间**：双击时间显示区域或点击「设置」按钮
- **开始/暂停**：点击控制栏中的开始/暂停按钮
- **重置**：点击控制栏中的重置按钮

### 秒表模式

- **开始/暂停**：点击控制栏中的开始/暂停按钮
- **重置**：点击控制栏中的重置按钮

## 自定义

### 音频文件

倒计时结束提示音可以自定义，只需替换 `public/ding.mp3` 文件即可。

### 性能优化配置

项目已配置了多种性能优化策略：

1. **智能缓存策略**：
   - 基于版本号的缓存控制：当应用版本更新时，自动刷新所有缓存资源
   - 字体文件：30天缓存
   - 图片文件：1天缓存
   - 音频文件：2天缓存
   - CSS/JS文件：1年缓存（不变资源）

2. **构建优化**：
   - 代码分割和懒加载
   - 生产环境移除 console 和 debugger
   - 资源压缩和优化

3. **第三方服务**：
   - Microsoft Clarity 脚本延迟加载
   - Google Fonts 优化加载

### SEO 优化

- 完整的 meta 标签配置
- Open Graph 社交媒体分享优化
- 结构化数据（Schema.org）
- 网站地图和 robots.txt
- 百度站点验证支持

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 浏览器支持

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+
- 移动端浏览器

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 作者

**QQHKX** - [网站](https://qqhkx.com)

## 更新日志

### v2.2.1
- 🚀 添加基于版本号的智能缓存控制：版本更新时自动刷新所有资源
- 🔄 优化资源加载策略：为所有静态资源添加版本号查询参数
- 📦 更新manifest.json：添加版本号字段
- 🛠️ 修复TypeScript配置：解决Vercel部署时的构建错误

### v2.1.0
- 🎯 优化倒计时双击功能：移除状态限制，允许运行时重新设置
- 📱 全局禁用触屏双击缩放：提升移动端用户体验
- 🎨 优化时钟模式界面：移除不必要的提示文字
- ✨ 增强HUD动画效果：添加淡入淡出、滑动和缩放动画
- 🔧 改进交互体验：统一可访问性支持和触摸反馈
- 🎭 动画优化：支持减少动画偏好设置

### v2.0.0
- 🚀 添加 Vercel 部署支持
- ⚡ 性能优化：缓存策略、代码分割
- 📊 集成 Microsoft Clarity 用户分析
- 🎨 UI/UX 改进和响应式优化
- 🔧 构建配置优化
- 📱 PWA 支持增强

---

**沉浸式时钟** - 让时间显示更优雅 ⏰