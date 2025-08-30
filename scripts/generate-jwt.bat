@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    和风天气 JWT Token 生成工具
echo ========================================
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到Node.js
    echo 请先安装Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 检查是否在正确的目录
if not exist "generate-jwt.js" (
    echo ❌ 错误: 未找到generate-jwt.js文件
    echo 请确保在scripts目录下运行此脚本
    echo.
    pause
    exit /b 1
)

REM 运行JWT生成脚本
echo 🚀 正在生成JWT token...
echo.
node generate-jwt.js

echo.
echo ========================================
echo 按任意键退出...
pause >nul