@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 和风天气API功能测试工具
echo ========================================
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 检查测试脚本是否存在
if not exist "%~dp0api-test.js" (
    echo ❌ 错误: 未找到 api-test.js 文件
    echo 请确保文件位于 scripts 目录中
    echo.
    pause
    exit /b 1
)

REM 检查.env.local文件是否存在
if not exist "%~dp0..\.env.local" (
    echo ⚠️  警告: 未找到 .env.local 文件
    echo 请先配置环境变量文件
    echo.
    echo 1. 复制 .env.local.example 为 .env.local
    echo 2. 配置 REACT_APP_QWEATHER_HOST 和 REACT_APP_QWEATHER_API_KEY
    echo.
    pause
    exit /b 1
)

echo 🚀 开始执行API测试...
echo.

REM 切换到脚本目录
cd /d "%~dp0"

REM 运行测试脚本
node api-test.js

REM 检查执行结果
if errorlevel 1 (
    echo.
    echo ❌ 测试执行失败
    echo.
    echo 故障排除建议:
    echo 1. 检查网络连接
    echo 2. 验证 JWT Token 是否正确和有效
    echo 3. 确认 API Host 地址是否正确
    echo 4. 检查 .env.local 文件配置
    echo.
) else (
    echo.
    echo ✅ 测试执行完成
    echo.
)

echo 按任意键退出...
pause >nul