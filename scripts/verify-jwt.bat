@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo 和风天气JWT Token验证工具
echo ========================================
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未检测到Node.js
    echo 请先安装Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 检查verify-jwt.js文件是否存在
if not exist "verify-jwt.js" (
    echo ❌ 错误：找不到verify-jwt.js文件
    echo 请确保在scripts目录下运行此脚本
    echo.
    pause
    exit /b 1
)

REM 运行JWT验证脚本
echo 🔍 开始验证JWT Token...
echo.
node verify-jwt.js %1

echo.
echo ========================================
echo 验证完成！
echo.
echo 💡 使用提示：
echo   - 如果验证失败，请检查jwt-config.json配置
echo   - 确保Ed25519密钥对正确生成
echo   - 检查凭据ID和项目ID是否正确
echo   - JWT token有效期不应超过24小时
echo.
pause