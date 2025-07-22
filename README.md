# 沉浸式时钟

一个沉浸式的全屏时钟应用，提供时钟、倒计时和秒表功能，具有现代化UI和流畅的用户体验。

![沉浸式时钟](https://via.placeholder.com/800x400?text=沉浸式时钟+截图)

## 功能特点

- **三种模式**：时钟、倒计时、秒表
- **沉浸式界面**：全屏显示，简约现代的设计
- **响应式设计**：适配各种屏幕尺寸，包括移动设备
- **交互式控制**：点击屏幕显示/隐藏控制界面
- **倒计时功能**：
  - 自定义设置时间
  - 预设常用时间段
  - 结束提示音
- **秒表功能**：
  - 精确计时
  - 里程碑提示
- **无障碍支持**：
  - 键盘导航
  - 高对比度模式
  - 减少动画模式

## 技术栈

- React 18
- TypeScript
- React Router
- CSS Modules
- Vite
- React Feather (图标)

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

## 项目结构

```
/
├── public/            # 静态资源
│   └── ding.mp3       # 倒计时结束提示音
├── src/
│   ├── components/    # 组件
│   │   ├── AuthorInfo/       # 作者信息组件
│   │   ├── Clock/            # 时钟组件
│   │   ├── ControlBar/       # 控制栏组件
│   │   ├── Countdown/        # 倒计时组件
│   │   ├── CountdownModal/   # 倒计时设置模态框
│   │   ├── HUD/              # 抬头显示控制界面
│   │   ├── ModeSelector/     # 模式选择器
│   │   └── Stopwatch/        # 秒表组件
│   ├── contexts/      # 上下文
│   │   └── AppContext.tsx    # 应用状态管理
│   ├── hooks/         # 自定义钩子
│   │   ├── useAudio.ts       # 音频播放钩子
│   │   ├── useFullscreen.ts  # 全屏控制钩子
│   │   └── useTimer.ts       # 计时器钩子
│   ├── pages/         # 页面
│   │   └── ClockPage/        # 主时钟页面
│   ├── styles/        # 全局样式
│   │   ├── global.css        # 全局CSS
│   │   └── variables.css     # CSS变量
│   ├── types/         # 类型定义
│   │   └── index.ts          # 类型声明
│   ├── utils/         # 工具函数
│   │   └── formatTime.ts     # 时间格式化
│   ├── App.tsx        # 应用入口组件
│   └── main.tsx       # 应用渲染入口
├── index.html         # HTML模板
├── package.json       # 项目配置
├── tsconfig.json      # TypeScript配置
└── vite.config.ts     # Vite配置
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

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 作者

[QQHKX](https://qqhkx.com)

---

**沉浸式时钟** - 让时间显示更优雅