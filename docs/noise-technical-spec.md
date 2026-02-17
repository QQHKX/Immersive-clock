# 沉浸式时钟噪音计算与评分技术文档

Immersive Clock 的噪音监测系统不仅仅是一个简单的分贝计，它内置了一个基于心理声学与专注力理论的评分引擎。该引擎旨在客观、多维度地量化环境噪音对学习心流的干扰程度。

本文档从用户视角和技术实现两个层面，详细解析了该系统的计算原理、核心指标定义、评分算法及完整的技术架构。

## 目录

1. [核心理念](#1-核心理念)
2. [系统架构](#2-系统架构)
3. [数据采集层](#3-数据采集层)
4. [数据聚合层](#4-数据聚合层)
5. [评分算法核心](#5-评分算法核心)
6. [数据存储层](#6-数据存储层)
7. [历史报告生成](#7-历史报告生成)
8. [流服务整合](#8-流服务整合)
9. [配置参数体系](#9-配置参数体系)
10. [类型定义](#10-类型定义)
11. [测试覆盖](#11-测试覆盖)

---

## 1. 核心理念

### 1.1 设计原则

系统认为，并非所有"响声"都是一样的。对于专注力而言：

- **持续的嗡嗡声**（如嘈杂的人群）比**偶尔的掉笔声**更具破坏性
- **频繁的打断**（如每分钟都有人说话）比**单次的大声喧哗**更让人烦躁
- **评分与校准分离**：评分使用原始 DBFS 数据，校准仅影响显示分贝

因此，评分系统采用了 **多维度加权扣分制**，满分 100 分，根据环境表现进行扣分。

### 1.2 评分与校准分离

项目通过"原始数据（用于评分）"与"显示数据（用于展示）"的**严格分层**，杜绝了校准值导致的评分偏差：

1. **评分只依赖原始 DBFS（设备输出的相对电平）**
   - 评分的三项核心指标（`p50Dbfs`、`overRatioDbfs`、`segmentCount`）都来自原始 `dbfs` 统计
   - "超阈时长占比"判定条件固定为：`dbfs > scoreThresholdDbfs`（阈值默认 `-50 dBFS`），与校准无关
   - 这意味着即使用户把"显示分贝基准"调高/调低，评分侧的 `dbfs` 不会变化，因此得分与超阈时长也不会被"调参刷分"

2. **校准仅影响 Display dB（UI 展示口径），不进入评分链路**
   - 校准（`baselineRms` / `baselineDb`）只用于将 `rms` 映射为 `displayDb`，用于实时显示与报告中的"噪音等级分布"等图表展示
   - 这些展示口径变化不会反向影响评分输入，也不会改变切片摘要中的 `raw.*` 字段

3. **统计报告中"超阈时长"取自 raw.overRatioDbfs**
   - 报告里展示的"超阈时长"是对每个切片 `raw.overRatioDbfs` 按有效采样时长加权汇总得到，仍然完全基于 DBFS
   - 相比之下，"噪音等级分布"使用的是 `display.avgDb`（校准后的显示分贝），因此它会随校准变化——这是为了更贴近用户直觉的 dB 区间划分

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 实时监控组件  │  │ 噪音报告弹窗  │  │ 噪音历史列表  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 订阅/发布
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        流服务层                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  noiseStreamService.ts - 噪音流服务                      │   │
│  │  - 订阅管理、生命周期控制、设置热更新                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 帧数据流
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        数据聚合层                                 │
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │ noiseFrameProcessor│  │ noiseSliceAggregator              │  │
│  │ - RMS/dBFS 计算   │  │ - 切片聚合、统计指标、评分计算      │  │
│  │ - 50ms/帧         │  │ - 30秒/切片                         │  │
│  └──────────────────┘  └────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ noiseRealtimeRingBuffer - 实时环形缓冲区                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 音频流
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        数据采集层                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ noiseCapture.ts - 麦克风采集                             │   │
│  │ - Web Audio API、滤波器、AnalyserNode                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 物理音频
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        数据存储层                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ noiseSliceService.ts - 切片存储                           │   │
│  │ - localStorage、时间清理、容量限制                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 历史数据
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        历史报告层                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ noiseHistoryBuilder.ts - 历史构建                         │   │
│  │ - 课表关联、加权平均评分、覆盖率计算                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 关键文件索引

| 模块 | 文件路径 | 说明 |
|------|---------|------|
| 类型定义 | [src/types/noise.ts](file:///d:/Desktop/Immersive-clock/src/types/noise.ts) | 核心类型定义 |
| 常量定义 | [src/constants/noise.ts](file:///d:/Desktop/Immersive-clock/src/constants/noise.ts) | 分析参数常量 |
| 常量定义 | [src/constants/noiseReport.ts](file:///d:/Desktop/Immersive-clock/src/constants/noiseReport.ts) | 报告参数常量 |
| 麦克风采集 | [src/services/noise/noiseCapture.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/noiseCapture.ts) | 音频采集 |
| 帧处理器 | [src/services/noise/noiseFrameProcessor.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/noiseFrameProcessor.ts) | 帧处理 |
| 切片聚合器 | [src/services/noise/noiseSliceAggregator.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/noiseSliceAggregator.ts) | 切片聚合 |
| 环形缓冲区 | [src/services/noise/noiseRealtimeRingBuffer.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/noiseRealtimeRingBuffer.ts) | 实时数据 |
| 流服务 | [src/services/noise/noiseStreamService.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/noiseStreamService.ts) | 流管理 |
| 评分引擎 | [src/utils/noiseScoreEngine.ts](file:///d:/Desktop/Immersive-clock/src/utils/noiseScoreEngine.ts) | 评分算法 |
| 切片服务 | [src/utils/noiseSliceService.ts](file:///d:/Desktop/Immersive-clock/src/utils/noiseSliceService.ts) | 存储服务 |
| 历史构建 | [src/utils/noiseHistoryBuilder.ts](file:///d:/Desktop/Immersive-clock/src/utils/noiseHistoryBuilder.ts) | 历史报告 |
| 设置管理 | [src/utils/noiseControlSettings.ts](file:///d:/Desktop/Immersive-clock/src/utils/noiseControlSettings.ts) | 设置管理 |

---

## 3. 数据采集层

### 3.1 麦克风采集 (noiseCapture.ts)

#### 3.1.1 Web Audio API 使用

系统使用 Web Audio API 获取麦克风输入，构建完整的音频处理链路：

```typescript
// 音频处理链路
麦克风 → MediaStream → MediaStreamAudioSourceNode 
       → 高通滤波器 (80Hz) → 低通滤波器 (8000Hz) 
       → AnalyserNode (FFT Size 2048)
```

#### 3.1.2 音频滤波器配置

| 滤波器类型 | 截止频率 | 作用 |
|-----------|---------|------|
| 高通滤波器 | 80 Hz | 过滤低频噪音（如空调嗡嗡声） |
| 低通滤波器 | 8000 Hz | 过滤高频噪音（如电子设备啸叫） |

#### 3.1.3 AnalyserNode 配置

```typescript
analyser.fftSize = 2048;           // FFT 窗口大小
analyser.smoothingTimeConstant = 0; // 无平滑，实时响应
```

#### 3.1.4 权限处理与错误处理

```typescript
// 麦克风权限请求配置
{
  audio: {
    echoCancellation: false,    // 禁用回声消除
    noiseSuppression: false,    // 禁用降噪
    autoGainControl: false,     // 禁用自动增益
  },
  video: false
}
```

**浏览器兼容性说明：**
- 部分浏览器/设备可能忽略上述约束设置
- 建议在 UI 中提示用户实际生效的约束
- 需要测试矩阵验证：Chrome/Firefox/Safari/Edge/iOS Safari/Android WebView

**错误处理：**
- `NotAllowedError` / `SecurityError` → 权限拒绝
- `AudioContext not supported` → 浏览器不支持

#### 3.1.5 核心函数

```typescript
/**
 * 启动环境噪音采集
 * @param options 采集配置选项
 * @returns 返回包含音频上下文和分析器的会话对象
 */
export async function startNoiseCapture(
  options?: NoiseCaptureOptions
): Promise<NoiseCaptureSession>

/**
 * 停止噪音采集并释放资源
 * @param session 需要停止的采集会话
 */
export async function stopNoiseCapture(
  session: NoiseCaptureSession | { audioContext?: AudioContext; stream?: MediaStream }
): Promise<void>
```

---

### 3.2 帧处理器 (noiseFrameProcessor.ts)

#### 3.2.1 采样频率

- **帧间隔**：50ms（约 20 fps）
- **数据来源**：AnalyserNode.getFloatTimeDomainData()

#### 3.2.2 RMS（均方根）计算

RMS 是衡量音频信号强度的标准方法：

```typescript
/**
 * 计算音频数据的 RMS (均方根) 和峰值
 * @param data 浮点音频采样数据
 * @returns 包含 RMS 和峰值的对象
 */
function computeRmsAndPeak(data: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const av = Math.abs(v);
    if (av > peak) peak = av;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, data.length));
  return { rms, peak };
}
```

**公式：**
$$ \text{RMS} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} x_i^2} $$

#### 3.2.3 dBFS（分贝满刻度）转换

dBFS 是数字音频的标准分贝单位，范围 -100 到 0 dB：

```typescript
/**
 * 将 RMS 转换为分贝 (dBFS)
 * @param rms 均方根值
 * @returns 分贝值，范围限制在 -100 到 0 dB
 */
function computeDbfsFromRms(rms: number): number {
  const safe = Math.max(1e-12, rms);
  const dbfs = 20 * Math.log10(safe);
  return Math.max(-100, Math.min(0, dbfs));
}
```

**公式：**
$$ \text{dBFS} = 20 \times \log_{10}(\text{RMS}) $$

**范围限制：**
- 最小值：-100 dBFS（静音）
- 最大值：0 dBFS（满刻度）

#### 3.2.4 峰值检测

峰值用于检测突发噪音：

```typescript
// 在 RMS 计算过程中同时记录峰值
for (let i = 0; i < data.length; i++) {
  const v = data[i];
  const av = Math.abs(v);
  if (av > peak) peak = av;
  sum += v * v;
}
```

#### 3.2.5 核心函数

```typescript
/**
 * 创建噪音帧处理器
 * @param options 配置选项
 * @returns 返回控制器对象 (start, stop, isRunning)
 */
export function createNoiseFrameProcessor(
  options: NoiseFrameProcessorOptions
): NoiseFrameProcessorController
```

---

## 4. 数据聚合层

### 4.1 切片聚合器 (noiseSliceAggregator.ts)

#### 4.1.1 切片时长

- **默认切片时长**：30 秒
- **可配置范围**：≥ 1 秒

#### 4.1.2 统计指标计算

切片聚合器为每个切片计算以下统计指标：

| 指标 | 说明 | 计算方法 |
|------|------|---------|
| avgDbfs | 平均分贝 | 能量平均（线性域 RMS 平均后转回 dBFS） |
| maxDbfs | 最大分贝 | 所有帧 dBFS 的最大值 |
| p50Dbfs | 中位数分贝 | 线性域分位数（RMS 域计算后转回 dBFS） |
| p95Dbfs | 95分位数分贝 | 线性域分位数（RMS 域计算后转回 dBFS） |
| overRatioDbfs | 超阈值比例 | 超阈值时长 / 采样时长 |
| segmentCount | 事件段数量 | 独立噪音事件次数 |
| sampledDurationMs | 采样时长 | 有效采样时间（排除缺口） |
| gapCount | 缺口数量 | 数据缺口次数 |
| maxGapMs | 最大缺口时长 | 最长数据缺口时长 |

#### 4.1.3 能量平均计算（avgDbfs）

```typescript
/**
 * 从 dBFS 数组计算能量平均后的 dBFS 值
 * @param dbfsArr dBFS 值数组
 * @returns 能量平均后的 dBFS 值
 */
function computeAvgDbfsFromDbfsArray(dbfsArr: number[]): number {
  if (dbfsArr.length === 0) return -100;
  // 在线性能量域求平均
  const meanSquare = dbfsArr.reduce((s, db) => s + Math.pow(10, db / 10), 0) / dbfsArr.length;
  const overallRms = Math.sqrt(meanSquare);
  const avgDbfs = 20 * Math.log10(Math.max(overallRms, 1e-12));
  return Math.max(-100, Math.min(0, avgDbfs));
}
```

**公式：**
$$ \text{avgDbfs} = 20 \times \log_{10}\left(\sqrt{\frac{1}{N} \sum_{i=1}^{N} 10^{\text{dBFS}_i / 10}}\right) $$

**物理意义：** 在线性域（RMS）上做平均，符合能量守恒定律

#### 4.1.4 线性域分位数计算

```typescript
/**
 * 从 dBFS 数组计算线性域分位数后的 dBFS 值
 * @param dbfsArr dBFS 值数组
 * @param p 分位数 (0-1)
 * @returns 线性域分位数后的 dBFS 值
 */
function computeQuantileFromDbfsArray(dbfsArr: number[], p: number): number {
  if (dbfsArr.length === 0) return -100;
  // 转换到线性域
  const rmsArr = dbfsArr.map(db => Math.pow(10, db / 20));
  rmsArr.sort((a, b) => a - b);
  // 计算分位数
  const idx = (rmsArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  const quantileRms = lo === hi ? rmsArr[lo] : rmsArr[lo] * (1 - w) + rmsArr[hi] * w;
  // 转回 dBFS
  return 20 * Math.log10(Math.max(quantileRms, 1e-12));
}
```

**公式：**
$$ \text{quantileDbfs} = 20 \times \log_{10}(Q_{\text{RMS}}(p)) $$

其中 $Q_{\text{RMS}}(p)$ 是 RMS 域的分位数，使用线性插值计算：
$$ Q_{\text{RMS}}(p) = x_{\lfloor i \rfloor} \times (1 - w) + x_{\lceil i \rceil} \times w $$

- $i = (n-1) \times p$
- $w = i - \lfloor i \rfloor$

**物理意义：** 在线性域（RMS）上计算分位数，符合能量统计的严谨性

#### 4.1.5 超阈值比例计算（时间加权）

```typescript
// 在切片聚合器中记录超阈值时长
let aboveDurationMs = 0;

const isAbove = frame.dbfs > scoreOpt.scoreThresholdDbfs;
if (isAbove) {
  aboveFrames += 1;
  aboveDurationMs += frameMs; // 累积超阈值时长
}

// 切片完成时计算
overRatioDbfs: sampledDurationMs > 0 ? aboveDurationMs / sampledDurationMs : 0
```

**公式：**
$$ \text{overRatioDbfs} = \frac{\text{超阈值时长}}{\text{采样时长}} $$

**物理意义：** 使用实际时长而非帧数计算比例，更精确

#### 4.1.6 事件段检测与合并算法

事件段检测用于识别独立的噪音事件：

```typescript
const isAbove = frame.dbfs > scoreOpt.scoreThresholdDbfs;
if (isAbove) {
  aboveFrames += 1;
  if (!lastAbove) {
    // 检查是否与上一段合并
    const merged =
      lastSegmentEndTs !== null && 
      frame.t - lastSegmentEndTs <= scoreOpt.segmentMergeGapMs;
    if (!merged) segmentCount += 1;
    lastAbove = true;
  }
} else if (lastAbove) {
  lastAbove = false;
  lastSegmentEndTs = frame.t;
}
```

**合并规则：**
- **合并窗口**：500ms（默认）
- 如果两次超阈值事件间隔 ≤ 500ms，合并为同一事件段
- 否则计为新的独立事件段

**示例：**
```
时间轴：  0ms    200ms   400ms   600ms   800ms   1000ms
状态：    [噪音] [噪音] [安静] [噪音] [噪音] [安静]
合并后：  └─────── 事件段1 ───────┘  └── 事件段2 ──┘
```

#### 4.1.7 显示分贝映射（校准机制）

显示分贝用于用户界面展示，支持校准：

```typescript
/**
 * 从 RMS 计算显示的分贝值
 * @param params 包含当前 RMS、基准 RMS 和基准分贝的对象
 * @returns 显示的分贝值，范围限制在 20 到 100 dB
 */
function computeDisplayDbFromRms(params: {
  rms: number;
  baselineRms: number;
  displayBaselineDb: number;
}): number {
  const safeRms = Math.max(1e-12, params.rms);
  let displayDb: number;
  if (params.baselineRms > 0) {
    // 使用校准基准
    displayDb =
      params.displayBaselineDb + 20 * Math.log10(safeRms / Math.max(1e-12, params.baselineRms));
  } else {
    // 默认映射：1e-3 RMS → 60 dB
    displayDb = 20 * Math.log10(safeRms / 1e-3) + 60;
  }
  return Math.max(20, Math.min(100, displayDb));
}
```

**公式（有校准）：**
$$ \text{displayDb} = \text{baselineDb} + 20 \times \log_{10}\left(\frac{\text{rms}}{\text{baselineRms}}\right) $$

**公式（无校准）：**
$$ \text{displayDb} = 20 \times \log_{10}\left(\frac{\text{rms}}{10^{-3}}\right) + 60 $$

**范围限制：** 20 dB ~ 100 dB

**校准流程说明：**
1. 使用标准声源（如 60 dB 的白噪音）
2. 测量对应的 RMS 值
3. 设置为 baselineRms
4. 设置对应的显示分贝为 baselineDb

#### 4.1.8 缺口检测与采样时长统计

```typescript
const gapThresholdMs = Math.max(1000, Math.round(frameMs * 5));

if (lastFrameTs !== null) {
  const dt = frame.t - lastFrameTs;
  if (dt > 0 && dt <= gapThresholdMs) {
    // 正常间隔，计入采样时长
    sampledDurationMs += dt;
  } else if (dt > gapThresholdMs) {
    // 检测到缺口
    gapCount += 1;
    if (dt > maxGapMs) maxGapMs = dt;
    // 缺口触发切片完成
    pendingSlice = finalizeSlice(lastFrameTs, frame.t);
  }
}
```

**缺口阈值：** `max(1000ms, frameMs × 5)` = **1000ms**（默认）

#### 4.1.9 无效帧过滤

```typescript
const INVALID_DBFS_THRESHOLD = -90;

if (frame.dbfs < INVALID_DBFS_THRESHOLD) {
  return pendingSlice; // 跳过统计
}
```

低于 -90 dBFS 的帧被视为静音/无效信号，不参与统计。

**常量说明：**
- `INVALID_DBFS_THRESHOLD = -90`：统计意义上的"静音"阈值
- `DBFS_MIN_POSSIBLE = -100`：物理最小可表示值（用于 clamp）
- `DBFS_MAX_POSSIBLE = 0`：物理最大可表示值（用于 clamp）

#### 4.1.10 核心函数

```typescript
/**
 * 创建噪音片段聚合器
 * @param options 配置选项
 * @returns 返回包含 onFrame, flush, reset 等方法的对象
 */
export function createNoiseSliceAggregator(
  options: NoiseSliceAggregatorOptions
): NoiseSliceAggregatorController
```

---

### 4.2 实时环形缓冲区 (noiseRealtimeRingBuffer.ts)

#### 4.2.1 数据结构设计

环形缓冲区使用固定容量数组实现：

```typescript
const data: NoiseRealtimePoint[] = new Array(capacity);
let start = 0;   // 起始索引
let length = 0;  // 当前长度
```

#### 4.2.2 时间窗口裁剪策略

```typescript
const prune = (cutoffTs: number) => {
  while (length > 0) {
    const first = data[start];
    if (!first || first.t >= cutoffTs) break;
    start = (start + 1) % capacity;
    length -= 1;
  }
};
```

**裁剪规则：** 移除时间戳早于 `当前时间 - retentionMs` 的数据点

#### 4.2.3 核心函数

```typescript
/**
 * 创建实时噪音数据的环形缓冲区
 * @param params 包含保留时长 (retentionMs) 和容量 (capacity) 的对象
 * @returns 返回包含 push, snapshot, clear 方法的对象
 */
export function createNoiseRealtimeRingBuffer(params: {
  retentionMs: number;
  capacity: number;
}): NoiseRealtimeRingBuffer
```

---

## 5. 评分算法核心

### 5.1 三大核心指标

评分引擎从以下三个维度对噪音数据进行分析：

#### A. 持续噪音水平 (Sustained Level)

- **定义**：剔除突发噪音后的环境"底噪"水平
- **算法**：使用时段内所有帧的中位数电平 (`p50Dbfs`)
- **意义**：反映环境本身是否安静。如果环境中有持续的风扇声或交谈声，该指标会升高

#### B. 超阈值时长占比 (Over Threshold Ratio)

- **定义**：原始 `DBFS` 超过评分阈值（`scoreThresholdDbfs`）的时间比例
- **算法**：`超阈值时长 / 采样时长`（超标判定：`dbfs > scoreThresholdDbfs`）
- **意义**：反映环境的"纯净度"。即使是 0.1 秒的尖叫也会被精确计入，无法被平均值掩盖

> **提示**：评分阈值（`scoreThresholdDbfs`，单位 dBFS）与"界面报警/提示音"使用的显示分贝阈值（`maxLevelDb`，单位 dB）不是同一个概念；前者只用于评分，后者用于判定 noisy/quiet 与提示音触发。

#### C. 打断次数密度 (Interruption Density)

- **定义**：单位时间内（每分钟）发生的独立噪音事件次数
- **智能合并算法**：
  - 系统设有 **500ms** (默认) 的合并窗口
  - 如果两次响声间隔小于该窗口（如拉椅子的一连串声音），会被合并为 **1 次打断**
  - 只有间隔较长的响声才会被计为新的打断
- **意义**：反映环境的干扰频率。频繁的打断（如断断续续的说话声）比连续的噪音更易打断心流

### 5.2 评分引擎 (noiseScoreEngine.ts)

#### 5.2.1 三维度评分模型

评分系统从三个维度对噪音进行评估：

| 维度 | 权重 | 指标 | 满扣分条件 |
|------|------|------|-----------|
| **持续噪音** | 40% | p50Dbfs | 中位数超过阈值 6 dBFS |
| **超阈时长** | 30% | overRatioDbfs | 超阈时间占比 30% |
| **打断频次** | 30% | segmentCount | 6 次/分钟 |

#### 5.2.2 评分公式

**总惩罚系数：**
$$ \text{TotalPenalty} = 0.40 \times P_{\text{sustained}} + 0.30 \times P_{\text{time}} + 0.30 \times P_{\text{segment}} $$

**最终得分：**
$$ \text{Score} = 100 \times (1 - \text{TotalPenalty}) $$

#### 5.2.3 惩罚系数计算

##### A. 持续噪音惩罚

```typescript
const clampedP50Dbfs = clampDbfs(raw.p50Dbfs);
const sustainedLevelDbfs = clampedP50Dbfs;
const sustainedOver = Math.max(0, sustainedLevelDbfs - opt.scoreThresholdDbfs);
const sustainedPenalty = clamp01(sustainedOver / 6);
```

**公式：**
$$ P_{\text{sustained}} = \text{clamp}_{[0,1]}\left(\frac{\text{p50Dbfs} - \text{threshold}}{6}\right) $$

**满扣分条件：** `p50Dbfs - threshold ≥ 6 dBFS`

##### B. 超阈时长惩罚

```typescript
const timePenalty = clamp01(raw.overRatioDbfs / 0.3);
```

**公式：**
$$ P_{\text{time}} = \text{clamp}_{[0,1]}\left(\frac{\text{overRatioDbfs}}{0.3}\right) $$

**满扣分条件：** `overRatioDbfs ≥ 30%`

##### C. 打断频次惩罚

```typescript
const minutes = Math.max(1e-6, effectiveDurationMs / 60_000);
const segmentsPerMin = raw.segmentCount / minutes;
const segmentPenalty = clamp01(segmentsPerMin / Math.max(1e-6, opt.maxSegmentsPerMin));
```

**公式：**
$$ P_{\text{segment}} = \text{clamp}_{[0,1]}\left(\frac{\text{segmentCount} / \text{minutes}}{\text{maxSegmentsPerMin}}\right) $$

**满扣分条件：** `segmentsPerMin ≥ 6 次/分钟`

#### 5.2.4 权重解读

- **持续噪音 (40%)**：持续底噪仍会明显拉低分数
- **超阈时长 (30%)**：只要大部分时间安静，偶尔的噪音仍可被容忍
- **打断频次 (30%)**：强调"被频繁打断"对心流的破坏，提升对碎片化干扰的惩罚力度

#### 5.2.5 边界条件处理

```typescript
// DBFS 范围限制
function clampDbfs(dbfs: number): number {
  return Math.max(DBFS_MIN_POSSIBLE, Math.min(DBFS_MAX_POSSIBLE, dbfs));
}
// DBFS_MIN_POSSIBLE = -100
// DBFS_MAX_POSSIBLE = 0

// 0-1 范围限制
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// 评分范围限制
const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));
```

#### 5.2.6 有效时长处理

```typescript
const sampledDurationMs =
  typeof raw.sampledDurationMs === "number" && Number.isFinite(raw.sampledDurationMs)
    ? Math.max(0, raw.sampledDurationMs)
    : null;
const effectiveDurationMs =
  sampledDurationMs && sampledDurationMs > 0 ? sampledDurationMs : durationMs;
```

优先使用采样有效时长，不存在时回退到物理时长。

#### 5.2.7 核心函数

```typescript
/**
 * 计算噪音切片评分
 * 基于持续电平、时间占比和波动频率进行综合评估
 * @param raw 原始统计数据
 * @param durationMs 切片时长
 * @param options 可选配置
 * @returns 包含评分和评分明细的对象
 */
export function computeNoiseSliceScore(
  raw: NoiseSliceRawStats,
  durationMs: number,
  options?: Partial<ComputeNoiseScoreOptions>
): { score: number; scoreDetail: NoiseScoreBreakdown }
```

#### 5.2.8 评分示例

**场景 1：安静环境**
- p50Dbfs = -60 dBFS, threshold = -50 dBFS
- overRatioDbfs = 0.05 (5%)
- segmentCount = 1, duration = 30s

```
sustainedPenalty = clamp01((-60 - (-50)) / 6) = clamp01(-10/6) = 0
timePenalty = clamp01(0.05 / 0.3) = 0.167
segmentPenalty = clamp01((1/0.5) / 6) = clamp01(2/6) = 0.333

TotalPenalty = 0.4×0 + 0.3×0.167 + 0.3×0.333 = 0.15
Score = 100 × (1 - 0.15) = 85 分
```

**场景 2：嘈杂环境**
- p50Dbfs = -45 dBFS, threshold = -50 dBFS
- overRatioDbfs = 0.40 (40%)
- segmentCount = 8, duration = 30s

```
sustainedPenalty = clamp01((-45 - (-50)) / 6) = clamp01(5/6) = 0.833
timePenalty = clamp01(0.40 / 0.3) = 1.0
segmentPenalty = clamp01((8/0.5) / 6) = clamp01(16/6) = 1.0

TotalPenalty = 0.4×0.833 + 0.3×1.0 + 0.3×1.0 = 0.933
Score = 100 × (1 - 0.933) = 6.7 分
```

---

## 6. 数据存储层

### 6.1 切片服务 (noiseSliceService.ts)

#### 6.1.1 localStorage 存储策略

```typescript
const STORAGE_KEY = "noise-slices";
```

存储键：`noise-slices`

**隐私说明：**
- 存储内容：时间戳、噪音统计（不包含音频数据）
- 风险：可能泄露位置/日程信息
- 建议：在 UI 中提供"清除历史"功能

#### 6.1.2 时间窗口清理

```typescript
function getRetentionMs(): number {
  const days = getAppSettings().noiseControl.reportRetentionDays ?? 14;
  return Math.max(1, days) * DAY_MS;
}

const cutoff = normalized.end - getRetentionMs();
const timeTrimmed = list.filter((item) => item.end >= cutoff);
```

**变量说明：**
- `normalized` 是新写入的切片（经过 `normalizeSlice` 处理）
- 使用新切片的 `end` 作为基准计算 cutoff
- 这样可以确保新切片不会被清理

**默认保留时长：** 14 天
**可配置范围：** 1 ~ 365 天

#### 6.1.3 容量限制

```typescript
// 估算本地存储配额
const quotaBytes = cachedQuotaBytes;
const maxBytes = quotaBytes ? quotaBytes * 0.9 : null;

// 按容量裁剪
let trimmed = maxBytes ? trimByMaxBytes(timeTrimmed, maxBytes) : timeTrimmed;
```

**容量上限：** 本地存储配额的 90%

#### 6.1.4 数据规范化与校验

```typescript
function normalizeSlice(slice: NoiseSliceSummary): NoiseSliceSummary {
  return {
    ...slice,
    start: Math.round(slice.start),
    end: Math.round(slice.end),
    frames: Math.max(0, Math.round(slice.frames)),
    raw: {
      ...slice.raw,
      avgDbfs: round(slice.raw.avgDbfs, 3),
      maxDbfs: round(slice.raw.maxDbfs, 3),
      p50Dbfs: round(slice.raw.p50Dbfs, 3),
      p95Dbfs: round(slice.raw.p95Dbfs, 3),
      overRatioDbfs: round(slice.raw.overRatioDbfs, 4),
      segmentCount: Math.max(0, Math.round(slice.raw.segmentCount)),
    },
    display: {
      avgDb: round(slice.display.avgDb, 2),
      p95Db: round(slice.display.p95Db, 2),
    },
    score: Math.max(0, Math.min(100, round(slice.score, 1))),
  };
}
```

**工具函数说明：**
- `round(value, digits)`：四舍五入到指定小数位
- `isFiniteNumber(value)`：检查是否为有限数字

**精度控制：**
- dBFS：3 位小数
- overRatioDbfs：4 位小数
- 显示分贝：2 位小数
- 评分：1 位小数

#### 6.1.5 类型校验

```typescript
function isNoiseSliceSummary(value: unknown): value is NoiseSliceSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<NoiseSliceSummary>;
  const raw = v.raw as unknown;
  const display = v.display as unknown;
  const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const displayObj =
    display && typeof display === "object" ? (display as Record<string, unknown>) : null;
  return (
    isFiniteNumber(v.start) &&
    isFiniteNumber(v.end) &&
    isFiniteNumber(v.frames) &&
    !!rawObj &&
    isFiniteNumber(rawObj.avgDbfs) &&
    isFiniteNumber(rawObj.maxDbfs) &&
    isFiniteNumber(rawObj.p50Dbfs) &&
    isFiniteNumber(rawObj.p95Dbfs) &&
    isFiniteNumber(rawObj.overRatioDbfs) &&
    isFiniteNumber(rawObj.segmentCount) &&
    !!displayObj &&
    isFiniteNumber(displayObj.avgDb) &&
    isFiniteNumber(displayObj.p95Db) &&
    isFiniteNumber(v.score) &&
    !!v.scoreDetail &&
    typeof v.scoreDetail === "object"
  );
}
```

#### 6.1.6 核心函数

```typescript
/**
 * 读取噪音切片历史记录
 * @returns 噪音切片数组
 */
export function readNoiseSlices(): NoiseSliceSummary[]

/**
 * 写入新的噪音切片
 * 自动清理超出保留时长的旧记录
 * @param slice 噪音切片
 * @returns 更新后的切片数组
 */
export function writeNoiseSlice(slice: NoiseSliceSummary): NoiseSliceSummary[]

/**
 * 清空噪音切片记录
 */
export function clearNoiseSlices(): void

/**
 * 订阅噪音切片更新事件
 * @param handler 事件处理函数
 * @returns 取消订阅的函数
 */
export function subscribeNoiseSlicesUpdated(handler: () => void): () => void
```

---

## 7. 历史报告生成

### 7.1 历史构建器 (noiseHistoryBuilder.ts)

#### 7.1.1 与课表关联逻辑

```typescript
export function buildNoiseHistoryListItems(params: {
  slices: NoiseSliceSummary[];
  schedule: StudyPeriod[];
  windowMs?: number;
}): NoiseHistoryListItem[]
```

**关联规则：**
1. 按日期分组切片
2. 对每个日期的每个课时，查找重叠的切片
3. 计算该课时的平均评分

#### 7.1.2 时段平均评分计算（加权平均）

```typescript
/**
 * 计算时段平均评分（按切片与时段的重叠时长对 score 进行加权平均）
 */
function computeAvgScoreForRange(
  slices: NoiseSliceSummary[],
  startTs: number,
  endTs: number
): { avgScore: number | null; totalMs: number } {
  let totalMs = 0;
  let sumScore = 0;
  for (const s of slices) {
    const overlapStart = Math.max(startTs, s.start);
    const overlapEnd = Math.min(endTs, s.end);
    const overlapMs = overlapEnd - overlapStart;
    if (overlapMs <= 0) continue;

    const sliceMs = Math.max(1, s.end - s.start);
    const ratio = overlapMs / sliceMs;

    // 使用采样有效时长（sampledDurationMs）进行加权
    const effectiveMs = (s.raw.sampledDurationMs ?? sliceMs) * ratio;

    totalMs += effectiveMs;
    sumScore += s.score * effectiveMs;
  }
  return { avgScore: totalMs > 0 ? sumScore / totalMs : null, totalMs };
}
```

**公式：**
$$ \text{avgScore} = \frac{\sum_{i} \text{score}_i \times \text{effectiveMs}_i}{\sum_{i} \text{effectiveMs}_i} $$

其中：
$$ \text{effectiveMs}_i = \text{sampledDurationMs}_i \times \frac{\text{overlapMs}_i}{\text{sliceMs}_i} $$

#### 7.1.3 覆盖率计算

```typescript
coverageRatio: Math.max(0, Math.min(1, totalMs / periodMs))
```

**公式：**
$$ \text{coverageRatio} = \frac{\text{totalMs}}{\text{periodMs}} $$

**含义：** 课时内有效采样时长占课时总时长的比例

#### 7.1.4 日期时间处理

```typescript
function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDateTime(dateKey: string, timeStr: string): Date | null {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day, h, m, 0, 0);
}
```

**时区说明：**
- 使用本地时区
- 内部存储使用 UTC 时间戳
- 对外展示使用本地时间

**日期格式：** `YYYY-MM-DD`
**时间格式：** `HH:MM`

#### 7.1.5 跨天课时处理

```typescript
const end =
  endRaw.getTime() <= start.getTime()
    ? new Date(endRaw.getTime() + 24 * 60 * 60 * 1000)
    : endRaw;
```

如果结束时间 ≤ 开始时间，则课时跨越到次日。

#### 7.1.6 报告中的图表

在噪音统计报告中，您可以直观地看到这些数据：

- **评分走势图**：展示了 `Score` 随时间的变化，帮助您回顾专注状态
- **噪音等级分布**：将每一帧归类为安静/正常/吵闹/极吵，直观展示时间占比
- **扣分归因**：直接显示上述三个维度的扣分比例，告诉您为什么分低（是因为一直吵，还是因为总被打断）
- **打断次数密度**：展示每分钟被干扰的次数

---

## 8. 流服务整合

### 8.1 噪音流服务 (noiseStreamService.ts)

#### 8.1.1 订阅/发布模式

```typescript
const listeners = new Set<Listener>();

export function subscribeNoiseStream(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      void hardStop();
    }
  };
}

function emit() {
  snapshot = { ...snapshot, ringBuffer: ringBuffer.snapshot() };
  listeners.forEach((fn) => fn());
}
```

**模式：** 观察者模式
- 多个组件可同时订阅
- 最后一个订阅者取消时自动停止采集

#### 8.1.2 生命周期管理

```typescript
// 启动
async function hardStart() {
  if (running) return;
  running = true;
  stopped = false;
  warmupFramesRemaining = WARMUP_FRAME_COUNT;
  // ... 初始化采集、处理器、聚合器
}

// 停止
async function hardStop() {
  if (!running) return;
  running = false;
  stopped = true;
  // ... 清理资源
}

// 重启
export async function restartNoiseStream(): Promise<void> {
  await hardStop();
  if (listeners.size > 0) {
    await hardStart();
  }
}
```

#### 8.1.3 预热帧处理

```typescript
const WARMUP_FRAME_COUNT = 10; // 约 500ms

const processor = createNoiseFrameProcessor({
  onFrame: (frame) => {
    if (stopped) return;

    if (warmupFramesRemaining > 0) {
      warmupFramesRemaining -= 1;
      return; // 丢弃预热帧
    }

    // 处理有效帧
    // ...
  },
});
```

**目的：** 丢弃麦克风启动后的不稳定数据

#### 8.1.4 设置热更新响应

```typescript
settingsUnsubscribe = subscribeSettingsEvent(
  SETTINGS_EVENTS.NoiseControlSettingsUpdated,
  (evt: CustomEvent) => {
    // 更新设置
    const shouldRestart =
      nextFrameMs !== frameMs ||
      nextSliceSec !== sliceSec ||
      nextScoreThresholdDbfs !== scoreThresholdDbfs ||
      nextSegmentMergeGapMs !== segmentMergeGapMs ||
      nextMaxSegmentsPerMin !== maxSegmentsPerMin;

    if (shouldRestart && running) {
      void restartNoiseStream();
    }
  }
);
```

**需要重启的参数：**
- frameMs
- sliceSec
- scoreThresholdDbfs
- segmentMergeGapMs
- maxSegmentsPerMin

**无需重启的参数：**
- maxLevelDb
- showRealtimeDb
- alertSoundEnabled
- avgWindowSec
- baselineDb

#### 8.1.5 时间加权平均

```typescript
function computeTimeWeightedAverage(windowArr: { t: number; v: number }[], now: number): number {
  if (!windowArr.length) return 0;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < windowArr.length; i++) {
    const t0 = windowArr[i].t;
    const t1 = i < windowArr.length - 1 ? windowArr[i + 1].t : now;
    const dt = Math.max(0, t1 - t0);
    sum += windowArr[i].v * dt;
    total += dt;
  }
  return total > 0 ? sum / total : windowArr[windowArr.length - 1].v;
}
```

**公式：**
$$ \text{avg} = \frac{\sum_{i} v_i \times (t_{i+1} - t_i)}{\sum_{i} (t_{i+1} - t_i)} $$

#### 8.1.6 核心函数

```typescript
/**
 * 订阅噪音数据流
 * @param listener 监听器函数
 * @returns 取消订阅的函数
 */
export function subscribeNoiseStream(listener: Listener): () => void

/**
 * 获取噪音流当前快照
 * @returns 噪音流快照
 */
export function getNoiseStreamSnapshot(): NoiseStreamSnapshot

/**
 * 重启噪音采集流
 */
export async function restartNoiseStream(): Promise<void>
```

---

## 9. 配置参数体系

### 9.1 常量定义

#### 9.1.1 分析参数 (constants/noise.ts)

```typescript
export const NOISE_ANALYSIS_SLICE_SEC = 30;           // 切片时长 30 秒
export const NOISE_ANALYSIS_FRAME_MS = 50;            // 帧间隔 50ms
export const NOISE_SCORE_THRESHOLD_DBFS = -50;        // 评分阈值 -50dBFS
export const NOISE_SCORE_SEGMENT_MERGE_GAP_MS = 500;  // 事件段合并间隔 500ms
export const NOISE_SCORE_MAX_SEGMENTS_PER_MIN = 6;    // 每分钟最大事件段数 6
export const NOISE_REALTIME_CHART_SLICE_COUNT = 1;     // 实时图表切片数 1
```

**常量说明：**
- `NOISE_REALTIME_CHART_SLICE_COUNT = 1`：实时图表显示的切片数量

#### 9.1.2 报告参数 (constants/noiseReport.ts)

```typescript
export const DEFAULT_NOISE_REPORT_RETENTION_DAYS = 14;        // 默认保留 14 天
export const MIN_NOISE_REPORT_RETENTION_DAYS = 1;             // 最小保留 1 天
export const MAX_NOISE_REPORT_RETENTION_DAYS_FALLBACK = 365;  // 最大保留 365 天
```

### 9.2 设置管理 (noiseControlSettings.ts)

#### 9.2.1 固定参数

```typescript
const FIXED_NOISE_ANALYSIS_SETTINGS: Pick<
  NoiseControlSettings,
  "sliceSec" | "frameMs" | "scoreThresholdDbfs" | "segmentMergeGapMs" | "maxSegmentsPerMin"
> = {
  sliceSec: NOISE_ANALYSIS_SLICE_SEC,
  frameMs: NOISE_ANALYSIS_FRAME_MS,
  scoreThresholdDbfs: NOISE_SCORE_THRESHOLD_DBFS,
  segmentMergeGapMs: NOISE_SCORE_SEGMENT_MERGE_GAP_MS,
  maxSegmentsPerMin: NOISE_SCORE_MAX_SEGMENTS_PER_MIN,
};
```

**固定原因：** 保证评分口径稳定，避免用户通过调整参数"刷分"

#### 9.2.2 可配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxLevelDb | number | 55 | 最大允许噪音级别（显示分贝） |
| baselineDb | number | 40 | 手动基准显示分贝 |
| showRealtimeDb | boolean | true | 是否显示实时分贝 |
| avgWindowSec | number | 1 | 噪音平均时间窗（秒） |
| alertSoundEnabled | boolean | false | 超阈值提示音开关 |

#### 9.2.3 设置接口

```typescript
export interface NoiseControlSettings {
  maxLevelDb: number;              // 最大允许噪音级别
  baselineDb: number;              // 手动基准显示分贝
  showRealtimeDb: boolean;          // 是否显示实时分贝
  avgWindowSec: number;            // 噪音平均时间窗（秒）
  sliceSec: number;                // 切片时长（固定）
  frameMs: number;                 // 帧间隔（固定）
  scoreThresholdDbfs: number;      // 评分阈值（固定）
  segmentMergeGapMs: number;       // 事件段合并间隔（固定）
  maxSegmentsPerMin: number;       // 每分钟最大事件段数（固定）
  alertSoundEnabled: boolean;      // 超过阈值时播放提示音
}
```

#### 9.2.4 核心函数

```typescript
/**
 * 获取噪音控制设置
 * @returns 噪音控制设置对象
 */
export function getNoiseControlSettings(): NoiseControlSettings

/**
 * 保存噪音控制设置
 * @param settings 部分设置对象
 */
export function saveNoiseControlSettings(settings: Partial<NoiseControlSettings>): void

/**
 * 重置噪音控制设置为默认值
 */
export function resetNoiseControlSettings(): void
```

---

## 10. 类型定义

### 10.1 核心类型 (types/noise.ts)

#### 10.1.1 噪音帧采样

```typescript
export interface NoiseFrameSample {
  t: number;        // 时间戳
  rms: number;      // 均方根值
  dbfs: number;     // 分贝值 (dBFS)
  peak?: number;    // 峰值
}
```

#### 10.1.2 噪音切片原始统计

```typescript
export interface NoiseSliceRawStats {
  avgDbfs: number;              // 平均分贝
  maxDbfs: number;              // 最大分贝
  p50Dbfs: number;             // 中位数分贝
  p95Dbfs: number;             // 95分位数分贝
  overRatioDbfs: number;        // 超阈值比例
  segmentCount: number;         // 事件段数量
  sampledDurationMs?: number;   // 采样时长
  gapCount?: number;            // 缺口数量
  maxGapMs?: number;            // 最大缺口时长
}
```

#### 10.1.3 噪音切片显示统计

```typescript
export interface NoiseSliceDisplayStats {
  avgDb: number;    // 平均显示分贝
  p95Db: number;    // 95分位数显示分贝
}
```

#### 10.1.4 噪音评分明细

```typescript
export interface NoiseScoreBreakdown {
  sustainedPenalty: number;      // 持续噪音惩罚
  timePenalty: number;           // 时间惩罚
  segmentPenalty: number;        // 事件段惩罚
  thresholdsUsed: {
    scoreThresholdDbfs: number;      // 使用的评分阈值
    segmentMergeGapMs: number;       // 使用的合并间隔
    maxSegmentsPerMin: number;       // 使用的最大事件段数
  };
  sustainedLevelDbfs: number;    // 持续电平
  overRatioDbfs: number;         // 超阈值比例
  segmentCount: number;          // 事件段数量
  minutes: number;               // 时长（分钟）
  durationMs?: number;           // 物理时长
  sampledDurationMs?: number;    // 采样时长
  coverageRatio?: number;        // 覆盖率
}
```

#### 10.1.5 噪音切片摘要

```typescript
export interface NoiseSliceSummary {
  start: number;                      // 开始时间戳
  end: number;                        // 结束时间戳
  frames: number;                     // 帧数
  raw: NoiseSliceRawStats;            // 原始统计
  display: NoiseSliceDisplayStats;    // 显示统计
  score: number;                      // 评分
  scoreDetail: NoiseScoreBreakdown;   // 评分明细
}
```

#### 10.1.6 实时数据点

```typescript
export interface NoiseRealtimePoint {
  t: number;        // 时间戳
  dbfs: number;     // 分贝值 (dBFS)
  displayDb: number; // 显示分贝
}
```

#### 10.1.7 噪音流快照

```typescript
export interface NoiseStreamSnapshot {
  status: NoiseStreamStatus;          // 流状态
  realtimeDisplayDb: number;          // 实时显示分贝
  realtimeDbfs: number;               // 实时分贝 (dBFS)
  maxLevelDb: number;                 // 最大允许级别
  showRealtimeDb: boolean;            // 是否显示实时分贝
  alertSoundEnabled: boolean;         // 提示音开关
  ringBuffer: NoiseRealtimePoint[];   // 环形缓冲区快照
  latestSlice: NoiseSliceSummary | null; // 最新切片
}
```

#### 10.1.8 噪音流状态

```typescript
export type NoiseStreamStatus =
  | "initializing"      // 初始化中
  | "quiet"             // 安静
  | "noisy"             // 嘈杂
  | "permission-denied" // 权限拒绝
  | "error";            // 错误
```

---

## 11. 测试覆盖

### 11.1 测试文件列表

| 测试文件 | 测试内容 |
|---------|---------|
| [src/utils/__tests__/noiseScoreEngine.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseScoreEngine.test.ts) | 评分引擎测试 |
| [src/services/noise/__tests__/noiseFrameProcessor.test.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/__tests__/noiseFrameProcessor.test.ts) | 帧处理器测试 |
| [src/services/noise/__tests__/noiseSliceAggregator.test.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/__tests__/noiseSliceAggregator.test.ts) | 切片聚合器测试 |
| [src/services/noise/__tests__/noiseStreamService.test.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/__tests__/noiseStreamService.test.ts) | 流服务测试 |
| [src/utils/__tests__/noiseSliceService.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseSliceService.test.ts) | 切片服务测试 |
| [src/utils/__tests__/noiseHistoryBuilder.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseHistoryBuilder.test.ts) | 历史构建测试 |

### 11.2 测试场景

#### 11.2.1 评分引擎测试

- 边界条件测试（最小/最大值）
- 三维度惩罚独立测试
- 综合评分测试
- 有效时长处理测试

#### 11.2.2 帧处理器测试

- RMS 计算正确性
- dBFS 转换正确性
- 峰值检测正确性
- 定时器精度测试

#### 11.2.3 切片聚合器测试

- 统计指标计算正确性
- 分位数计算正确性
- 事件段检测与合并
- 显示分贝映射
- 缺口检测

#### 11.2.4 流服务测试

- 订阅/发布机制
- 生命周期管理
- 设置热更新
- 预热帧处理

#### 11.2.5 切片服务测试

- 读写操作
- 时间窗口清理
- 容量限制
- 数据规范化

#### 11.2.6 历史构建测试

- 课表关联
- 加权平均评分
- 覆盖率计算
- 跨天课时处理

### 11.3 测试覆盖建议

- 浏览器兼容性矩阵（Chrome/Firefox/Safari/Edge/iOS Safari/Android WebView）
- 性能测试（CPU、内存、持续运行对电池的影响）
- 集成/端到端测试（从权限请求到历史生成流程）
- 跨浏览器、移动端、电池/性能测试

---

## 附录

### A. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 均方根 | RMS (Root Mean Square) | 衡量音频信号强度的标准方法 |
| 分贝满刻度 | dBFS (Decibels relative to Full Scale) | 数字音频的标准分贝单位，范围 -100 到 0 dB |
| 显示分贝 | Display dB | 用于用户界面展示的分贝值，范围 20 到 100 dB |
| 切片 | Slice | 固定时间窗口（默认 30 秒）内的噪音数据聚合 |
| 帧 | Frame | 单次音频采样（默认 50ms） |
| 事件段 | Segment | 独立的噪音事件，通过合并窗口（500ms）合并 |

### B. 参数固定策略

为保证统计口径稳定，当前版本将"分析与评分"的高级参数固定为程序内常量：

| 参数 | 值 | 说明 |
|------|-----|------|
| frameMs | 50ms | 约 20fps |
| sliceSec | 30s | 切片时长 |
| scoreThresholdDbfs | -50 dBFS | 评分阈值 |
| segmentMergeGapMs | 500ms | 事件段合并间隔 |
| maxSegmentsPerMin | 6 | 每分钟最大事件段数 |
