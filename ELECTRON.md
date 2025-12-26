# Electron 版本使用说明

## 开发模式

运行 Electron 开发版本：

```bash
npm run dev:electron
```

这将启动 Vite 开发服务器和 Electron 应用，支持热重载。

## 构建应用

构建 Electron 桌面应用：

```bash
npm run build:electron
```

构建完成后，安装包将输出到 `release` 目录。

## 构建产物

根据您的操作系统，将生成以下安装包：

### Windows
- `沉浸式时钟-[版本]-x64-Setup.exe` - 64位安装程序
- `沉浸式时钟-[版本]-ia32-Setup.exe` - 32位安装程序
- `沉浸式时钟-[版本]-x64-Portable.exe` - 64位便携版

### macOS
- `沉浸式时钟-[版本]-x64.dmg` - Intel 芯片安装镜像
- `沉浸式时钟-[版本]-arm64.dmg` - Apple Silicon 安装镜像
- `沉浸式时钟-[版本]-x64.zip` - Intel 芯片压缩包
- `沉浸式时钟-[版本]-arm64.zip` - Apple Silicon 压缩包

### Linux
- `沉浸式时钟-[版本]-x64.AppImage` - AppImage 格式
- `沉浸式时钟-[版本]-amd64.deb` - Debian/Ubuntu 安装包
- `沉浸式时钟-[版本]-x86_64.rpm` - RedHat/Fedora 安装包

## 特性

Electron 版本提供以下特性：

- ✅ 独立桌面应用，无需浏览器
- ✅ 原生窗口控制
- ✅ 系统托盘支持（可扩展）
- ✅ 离线运行
- ✅ 更好的性能表现
- ✅ 支持 Windows、macOS 和 Linux

## 注意事项

1. 确保已安装 Node.js 14 或更高版本
2. 首次构建可能需要下载 Electron 二进制文件，请耐心等待
3. 构建 macOS 应用需要在 macOS 系统上进行
4. 如需代码签名，请配置 `electron-builder.json` 中的相关选项

## 技术栈

- Electron - 桌面应用框架
- Vite - 构建工具
- React - UI 框架
- TypeScript - 类型系统
- electron-builder - 打包工具
