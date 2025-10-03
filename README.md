# 沉浸式时钟 ⏰

一个现代化的全屏时钟应用，提供多种时间管理模式，具有优雅的界面设计和丰富的功能特性。

[![Version](https://img.shields.io/badge/version-3.3.6-blue.svg)](https://github.com/QQHKX/immersive-clock)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.3-blue.svg)](https://www.typescriptlang.org/)

## 🚀 缓存策略

本项目采用多层缓存优化策略，确保最佳性能和用户体验：

### 静态资源缓存
- **字体文件** (woff, woff2, ttf, otf): 30天强缓存 + immutable
- **图片资源** (png, jpg, svg, webp, ico): 1天缓存
- **音频文件** (mp3, wav, ogg, m4a): 2天缓存
- **JS/CSS 文件**: 1年强缓存 + immutable（依赖构建哈希更新）

### 关键文件版本化
- **manifest.webmanifest**: 版本参数 `?v=` 确保 PWA 更新
- **favicon.svg**: 版本参数确保图标刷新
- **HTML 文件**: 禁用缓存，确保实时更新

### PWA 离线策略
- **导航回退**: 支持所有同源路径离线访问
- **运行时缓存**: 图片、字体、音频采用 CacheFirst 策略
- **文档缓存**: Markdown 文档采用 NetworkFirst 策略

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 👨‍💻 作者

**QQHKX** - [个人网站](https://qqhkx.com) | [GitHub](https://github.com/QQHKX)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**沉浸式时钟** - 让时间管理更优雅，让学习更专注 ⏰✨