# 测试地图（Testing Map）

## 运行入口

- 单元测试：`npm run test`
- 单测 + 覆盖率：`npm run test:coverage`
- 端到端测试：`npm run test:e2e`
  - 默认使用系统 Edge（项目：`msedge`），不自动下载 Playwright 浏览器
  - 如需运行 Playwright 自带浏览器：设置 `PW_BUNDLED_BROWSERS=1` 后再运行 `npm run test:e2e`（会执行 `playwright install`）

## Vitest（单元测试）

### 配置

- Vitest 配置：[vitest.config.ts](file:///d:/Desktop/Immersive-clock/vitest.config.ts)
- 统一 setup（jest-dom、cleanup、matchMedia polyfill）：[setupTests.ts](file:///d:/Desktop/Immersive-clock/src/setupTests.ts)

### 覆盖范围（按模块）

- **设置/持久化**
  - AppSettings 深合并与局部更新：[appSettings.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/appSettings.test.ts) → [appSettings.ts](file:///d:/Desktop/Immersive-clock/src/utils/appSettings.ts)
  - 启动初始化与 legacy 键清理：[storageInitializer.legacyCleanup.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/storageInitializer.legacyCleanup.test.ts) + [storageInitializer.studyScheduleMigration.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/storageInitializer.studyScheduleMigration.test.ts) → [storageInitializer.ts](file:///d:/Desktop/Immersive-clock/src/utils/storageInitializer.ts)
- **天气**
  - 天气服务主流程与多分支回归：[weatherService.flow.test.ts](file:///d:/Desktop/Immersive-clock/src/services/__tests__/weatherService.flow.test.ts) + [weatherService.test.ts](file:///d:/Desktop/Immersive-clock/src/services/__tests__/weatherService.test.ts) → [weatherService.ts](file:///d:/Desktop/Immersive-clock/src/services/weatherService.ts)
  - 天气缓存（TTL/合并/清理）：[weatherStorage.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/weatherStorage.test.ts) → [weatherStorage.ts](file:///d:/Desktop/Immersive-clock/src/utils/weatherStorage.ts)
  - 预警筛选逻辑：[weatherAlert.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/weatherAlert.test.ts) → [weatherAlert.ts](file:///d:/Desktop/Immersive-clock/src/utils/weatherAlert.ts)
- **时间同步**
  - 时间源测量与中位数聚合：[timeSync.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/timeSync.test.ts) → [timeSync.ts](file:///d:/Desktop/Immersive-clock/src/utils/timeSync.ts)
  - NTP 客户端（mock dns/dgram）：[ntpClient.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/ntpClient.test.ts) → [ntpClient.ts](file:///d:/Desktop/Immersive-clock/src/utils/ntpClient.ts)
- **噪音**
  - 噪音样本存储与事件通知：[noiseDataService.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseDataService.test.ts) → [noiseDataService.ts](file:///d:/Desktop/Immersive-clock/src/utils/noiseDataService.ts)
- **公告**
  - 公告隐藏一周逻辑/版本强制显示：[announcementStorage.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/announcementStorage.test.ts) → [announcementStorage.ts](file:///d:/Desktop/Immersive-clock/src/utils/announcementStorage.ts)
- **通用**
  - 日志封装：[logger.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/logger.test.ts) → [logger.ts](file:///d:/Desktop/Immersive-clock/src/utils/logger.ts)
  - 时间格式化工具：[formatTime.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/formatTime.test.ts) → [formatTime.ts](file:///d:/Desktop/Immersive-clock/src/utils/formatTime.ts)
  - Dropdown 工具函数：[dropdownUtils.test.ts](file:///d:/Desktop/Immersive-clock/src/components/Dropdown/__tests__/dropdownUtils.test.ts) → `src/components/Dropdown/*`
  - 新手指引（守卫/完成事件）：[tourGuards.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/tourGuards.test.ts) + [tourFocus.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/tourFocus.test.ts) → [tour.ts](file:///d:/Desktop/Immersive-clock/src/utils/tour.ts)

## Playwright（端到端测试）

### 配置

- Playwright 配置：[playwright.config.ts](file:///d:/Desktop/Immersive-clock/playwright.config.ts)
- 启动弹窗关闭与 HUD 显示工具：[e2eUtils.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/e2eUtils.ts)

### 用例（关键用户路径）

- 首页加载 smoke：[clock.e2e.spec.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/clock.e2e.spec.ts)
- 模式切换回归（四模式可见）：[mode-switch.e2e.spec.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/mode-switch.e2e.spec.ts)
- 倒计时设置/开始/暂停/重置：[countdown.e2e.spec.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/countdown.e2e.spec.ts)
- 秒表开始/暂停/重置：[stopwatch.e2e.spec.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/stopwatch.e2e.spec.ts)
- 自习模式入口可见：[study-smoke.e2e.spec.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/study-smoke.e2e.spec.ts)
- 设置保存并写入本地存储（目标年份）：[settings-persistence.e2e.spec.ts](file:///d:/Desktop/Immersive-clock/tests/e2e/settings-persistence.e2e.spec.ts)
