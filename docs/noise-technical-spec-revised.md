# 噪音计算与评分技术规格文档（修订版）

> 本文档包含外部审查发现的问题标注，格式：`[问题编号] 问题描述`

## 目录

1. [系统概述](#1-系统概述)
2. [数据采集层](#2-数据采集层)
3. [数据聚合层](#3-数据聚合层)
4. [评分算法核心](#4-评分算法核心)
5. [数据存储层](#5-数据存储层)
6. [历史报告生成](#6-历史报告生成)
7. [流服务整合](#7-流服务整合)
8. [配置参数体系](#8-配置参数体系)
9. [类型定义](#9-类型定义)
10. [测试覆盖](#10-测试覆盖)
11. [问题汇总与修复建议](#11-问题汇总与修复建议)

---

## 1. 系统概述

### 1.1 核心理念

Immersive Clock 的噪音监测系统采用**多维度加权扣分制**评分模型，满分 100 分，根据环境噪音对学习心流的干扰程度进行综合评估。

**核心设计原则：**

- **持续噪音**（如嘈杂的人群）比**偶尔的噪音**（如掉笔声）更具破坏性
- **频繁的打断**（如每分钟都有人说话）比**单次的大声喧哗**更让人烦躁
- **评分与校准分离**：评分使用原始 DBFS 数据，校准仅影响显示分贝

### 1.2 系统架构

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

### 1.3 关键文件索引

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

## 2. 数据采集层

### 2.1 麦克风采集 (noiseCapture.ts)

#### 2.1.1 Web Audio API 使用

系统使用 Web Audio API 获取麦克风输入，构建完整的音频处理链路：

```typescript
// 音频处理链路
麦克风 → MediaStream → MediaStreamAudioSourceNode
       → 高通滤波器 (80Hz) → 低通滤波器 (8000Hz)
       → AnalyserNode (FFT Size 2048)
```

#### 2.1.2 音频滤波器配置

| 滤波器类型 | 截止频率 | 作用 |
|-----------|---------|------|
| 高通滤波器 | 80 Hz | 过滤低频噪音（如空调嗡嗡声） |
| 低通滤波器 | 8000 Hz | 过滤高频噪音（如电子设备啸叫） |

#### 2.1.3 AnalyserNode 配置

```typescript
analyser.fftSize = 2048;           // FFT 窗口大小
analyser.smoothingTimeConstant = 0; // 无平滑，实时响应
```

#### 2.1.4 权限处理与错误处理

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

**[问题8] 浏览器兼容性说明：**
- 部分浏览器/设备可能忽略上述约束设置
- 建议在 UI 中提示用户实际生效的约束
- 需要测试矩阵验证：Chrome/Firefox/Safari/Edge/iOS Safari/Android WebView

**错误处理：**
- `NotAllowedError` / `SecurityError` → 权限拒绝
- `AudioContext not supported` → 浏览器不支持

#### 2.1.5 核心函数

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

### 2.2 帧处理器 (noiseFrameProcessor.ts)

#### 2.2.1 采样频率

- **帧间隔**：50ms（约 20 fps）
- **数据来源**：AnalyserNode.getFloatTimeDomainData()

#### 2.2.2 RMS（均方根）计算

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

#### 2.2.3 dBFS（分贝满刻度）转换

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

#### 2.2.4 峰值检测

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

#### 2.2.5 核心函数

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

## 3. 数据聚合层

### 3.1 切片聚合器 (noiseSliceAggregator.ts)

#### 3.1.1 切片时长

- **默认切片时长**：30 秒
- **可配置范围**：≥ 1 秒

#### 3.1.2 统计指标计算

切片聚合器为每个切片计算以下统计指标：

| 指标 | 说明 | 计算方法 |
|------|------|---------|
| avgDbfs | 平均分贝 | 所有帧 dBFS 的算术平均 |
| maxDbfs | 最大分贝 | 所有帧 dBFS 的最大值 |
| p50Dbfs | 中位数分贝 | 排序后第 50% 分位数值 |
| p95Dbfs | 95分位数分贝 | 排序后第 95% 分位数值 |
| overRatioDbfs | 超阈值比例 | 超阈值帧数 / 总帧数 |
| segmentCount | 事件段数量 | 独立噪音事件次数 |
| sampledDurationMs | 采样时长 | 有效采样时间（排除缺口） |
| gapCount | 缺口数量 | 数据缺口次数 |
| maxGapMs | 最大缺口时长 | 最长数据缺口时长 |

**[问题4] avgDbfs 计算说明：**
- 当前实现：对 dBFS 值做算术平均
- 物理意义：不够严谨，应该在线性域（RMS）上做平均
- 影响评估：对于相对稳定的噪音环境，影响较小；对于波动较大的环境，可能低估平均能量
- 改进建议：见第 11 节

**[问题5] 分位数计算说明：**
- 当前实现：在 dB 域上计算分位数
- 物理意义：从感知角度可接受，但从能量统计角度不够严谨
- 改进建议：见第 11 节

#### 3.1.3 分位数计算

```typescript
/**
 * 计算已排序数组的分位数
 * @param sorted 已排序的数值数组
 * @param p 分位数 (0-1)
 * @returns 分位数值
 */
function quantileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const pp = Math.max(0, Math.min(1, p));
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * pp;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}
```

**公式（线性插值）：**
$$ Q(p) = x_{\lfloor i \rfloor} \times (1 - w) + x_{\lceil i \rceil} \times w $$

其中：
- $i = (n-1) \times p$
- $w = i - \lfloor i \rfloor$

#### 3.1.4 超阈值比例计算

```typescript
const isAbove = frame.dbfs > scoreOpt.scoreThresholdDbfs;
if (isAbove) {
  aboveFrames += 1;
}

// 切片完成时计算
overRatioDbfs: aboveFrames / frames
```

**公式：**
$$ \text{overRatioDbfs} = \frac{\text{超阈值帧数}}{\text{总帧数}} $$

**[问题6] 计算说明：**
- 当前实现：使用帧数占比
- 假设：帧间隔固定（50ms）
- 改进建议：可以使用时间加权计算，更精确

#### 3.1.5 事件段检测与合并算法

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

#### 3.1.6 显示分贝映射（校准机制）

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

**[问题7] 默认映射说明：**
- 默认映射 `1e-3 RMS → 60 dB` 是经验值
- 建议补充校准流程说明

#### 3.1.7 缺口检测与采样时长统计

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

**[问题1] 缺口阈值修正：**
- 代码：`Math.max(1000, Math.round(frameMs * 5))`
- frameMs = 50，所以 `frameMs * 5 = 250`
- `Math.max(1000, 250) = 1000`
- **实际阈值是 1000ms，不是 250ms**

**缺口阈值：** `max(1000ms, frameMs × 5)` = **1000ms**（默认）

#### 3.1.8 无效帧过滤

```typescript
const INVALID_DBFS_THRESHOLD = -90;

if (frame.dbfs < INVALID_DBFS_THRESHOLD) {
  return pendingSlice; // 跳过统计
}
```

低于 -90 dBFS 的帧被视为静音/无效信号，不参与统计。

**[问题2] 常量说明：**
- `INVALID_DBFS_THRESHOLD = -90`：统计意义上的"静音"阈值
- `DBFS_MIN_VALID = -100`：物理最小可表示值（用于 clamp）
- 两者用途不同，但命名容易混淆

#### 3.1.9 核心函数

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

### 3.2 实时环形缓冲区 (noiseRealtimeRingBuffer.ts)

#### 3.2.1 数据结构设计

环形缓冲区使用固定容量数组实现：

```typescript
const data: NoiseRealtimePoint[] = new Array(capacity);
let start = 0;   // 起始索引
let length = 0;  // 当前长度
```

#### 3.2.2 时间窗口裁剪策略

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

#### 3.2.3 核心函数

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

## 4. 评分算法核心

### 4.1 评分引擎 (noiseScoreEngine.ts)

#### 4.1.1 三维度评分模型

评分系统从三个维度对噪音进行评估：

| 维度 | 权重 | 指标 | 满扣分条件 |
|------|------|------|-----------|
| **持续噪音** | 40% | p50Dbfs | 中位数超过阈值 6 dBFS |
| **超阈时长** | 30% | overRatioDbfs | 超阈时间占比 30% |
| **打断频次** | 30% | segmentCount | 6 次/分钟 |

#### 4.1.2 评分公式

**总惩罚系数：**
$$ \text{TotalPenalty} = 0.40 \times P_{\text{sustained}} + 0.30 \times P_{\text{time}} + 0.30 \times P_{\text{segment}} $$

**最终得分：**
$$ \text{Score} = 100 \times (1 - \text{TotalPenalty}) $$

#### 4.1.3 惩罚系数计算

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

#### 4.1.4 边界条件处理

```typescript
// DBFS 范围限制
function clampDbfs(dbfs: number): number {
  return Math.max(DBFS_MIN_VALID, Math.min(DBFS_MAX_VALID, dbfs));
}
// DBFS_MIN_VALID = -100
// DBFS_MAX_VALID = 0

// 0-1 范围限制
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// 评分范围限制
const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));
```

#### 4.1.5 有效时长处理

```typescript
const sampledDurationMs =
  typeof raw.sampledDurationMs === "number" && Number.isFinite(raw.sampledDurationMs)
    ? Math.max(0, raw.sampledDurationMs)
    : null;
const effectiveDurationMs =
  sampledDurationMs && sampledDurationMs > 0 ? sampledDurationMs : durationMs;
```

优先使用采样有效时长，不存在时回退到物理时长。

#### 4.1.6 核心函数

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

#### 4.1.7 评分示例

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

## 5. 数据存储层

### 5.1 切片服务 (noiseSliceService.ts)

#### 5.1.1 localStorage 存储策略

```typescript
const STORAGE_KEY = "noise-slices";
```

存储键：`noise-slices`

**[问题9] 隐私说明：**
- 存储内容：时间戳、噪音统计（不包含音频数据）
- 风险：可能泄露位置/日程信息
- 建议：在 UI 中提供"清除历史"功能

#### 5.1.2 时间窗口清理

```typescript
function getRetentionMs(): number {
  const days = getAppSettings().noiseControl.reportRetentionDays ?? 14;
  return Math.max(1, days) * DAY_MS;
}

const cutoff = normalized.end - getRetentionMs();
const timeTrimmed = list.filter((item) => item.end >= cutoff);
```

**[问题3] 变量说明：**
- `normalized` 是新写入的切片（经过 `normalizeSlice` 处理）
- 使用新切片的 `end` 作为基准计算 cutoff
- 这样可以确保新切片不会被清理

**默认保留时长：** 14 天
**可配置范围：** 1 ~ 365 天

#### 5.1.3 容量限制

```typescript
// 估算本地存储配额
const quotaBytes = cachedQuotaBytes;
const maxBytes = quotaBytes ? quotaBytes * 0.9 : null;

// 按容量裁剪
let trimmed = maxBytes ? trimByMaxBytes(timeTrimmed, maxBytes) : timeTrimmed;
```

**容量上限：** 本地存储配额的 90%

#### 5.1.4 数据规范化与校验

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

**[问题11] 工具函数说明：**
- `round(value, digits)`：四舍五入到指定小数位
- `isFiniteNumber(value)`：检查是否为有限数字

**精度控制：**
- dBFS：3 位小数
- overRatioDbfs：4 位小数
- 显示分贝：2 位小数
- 评分：1 位小数

#### 5.1.5 类型校验

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

#### 5.1.6 核心函数

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

## 6. 历史报告生成

### 6.1 历史构建器 (noiseHistoryBuilder.ts)

#### 6.1.1 与课表关联逻辑

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

#### 6.1.2 时段平均评分计算（加权平均）

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

#### 6.1.3 覆盖率计算

```typescript
coverageRatio: Math.max(0, Math.min(1, totalMs / periodMs))
```

**公式：**
$$ \text{coverageRatio} = \frac{\text{totalMs}}{\text{periodMs}} $$

**含义：** 课时内有效采样时长占课时总时长的比例

#### 6.1.4 日期时间处理

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

**[问题12] 时区说明：**
- 使用本地时区
- 内部存储使用 UTC 时间戳
- 对外展示使用本地时间

**日期格式：** `YYYY-MM-DD`
**时间格式：** `HH:MM`

#### 6.1.5 跨天课时处理

```typescript
const end =
  endRaw.getTime() <= start.getTime()
    ? new Date(endRaw.getTime() + 24 * 60 * 60 * 1000)
    : endRaw;
```

如果结束时间 ≤ 开始时间，则课时跨越到次日。

---

## 7. 流服务整合

### 7.1 噪音流服务 (noiseStreamService.ts)

#### 7.1.1 订阅/发布模式

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

#### 7.1.2 生命周期管理

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

#### 7.1.3 预热帧处理

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

#### 7.1.4 设置热更新响应

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

#### 7.1.5 时间加权平均

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

#### 7.1.6 核心函数

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

## 8. 配置参数体系

### 8.1 常量定义

#### 8.1.1 分析参数 (constants/noise.ts)

```typescript
export const NOISE_ANALYSIS_SLICE_SEC = 30;           // 切片时长 30 秒
export const NOISE_ANALYSIS_FRAME_MS = 50;            // 帧间隔 50ms
export const NOISE_SCORE_THRESHOLD_DBFS = -50;        // 评分阈值 -50dBFS
export const NOISE_SCORE_SEGMENT_MERGE_GAP_MS = 500;  // 事件段合并间隔 500ms
export const NOISE_SCORE_MAX_SEGMENTS_PER_MIN = 6;    // 每分钟最大事件段数 6
export const NOISE_REALTIME_CHART_SLICE_COUNT = 1;     // 实时图表切片数 1
```

**[问题13] 常量说明：**
- `NOISE_REALTIME_CHART_SLICE_COUNT = 1`：实时图表显示的切片数量
- 建议补充注释说明

#### 8.1.2 报告参数 (constants/noiseReport.ts)

```typescript
export const DEFAULT_NOISE_REPORT_RETENTION_DAYS = 14;        // 默认保留 14 天
export const MIN_NOISE_REPORT_RETENTION_DAYS = 1;             // 最小保留 1 天
export const MAX_NOISE_REPORT_RETENTION_DAYS_FALLBACK = 365;  // 最大保留 365 天
```

### 8.2 设置管理 (noiseControlSettings.ts)

#### 8.2.1 固定参数

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

#### 8.2.2 可配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxLevelDb | number | 55 | 最大允许噪音级别（显示分贝） |
| baselineDb | number | 40 | 手动基准显示分贝 |
| showRealtimeDb | boolean | true | 是否显示实时分贝 |
| avgWindowSec | number | 1 | 噪音平均时间窗（秒） |
| alertSoundEnabled | boolean | false | 超阈值提示音开关 |

#### 8.2.3 设置接口

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

#### 8.2.4 核心函数

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

## 9. 类型定义

### 9.1 核心类型 (types/noise.ts)

#### 9.1.1 噪音帧采样

```typescript
export interface NoiseFrameSample {
  t: number;        // 时间戳
  rms: number;      // 均方根值
  dbfs: number;     // 分贝值 (dBFS)
  peak?: number;    // 峰值
}
```

#### 9.1.2 噪音切片原始统计

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

#### 9.1.3 噪音切片显示统计

```typescript
export interface NoiseSliceDisplayStats {
  avgDb: number;    // 平均显示分贝
  p95Db: number;    // 95分位数显示分贝
}
```

#### 9.1.4 噪音评分明细

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

#### 9.1.5 噪音切片摘要

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

#### 9.1.6 实时数据点

```typescript
export interface NoiseRealtimePoint {
  t: number;        // 时间戳
  dbfs: number;     // 分贝值 (dBFS)
  displayDb: number; // 显示分贝
}
```

#### 9.1.7 噪音流快照

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

#### 9.1.8 噪音流状态

```typescript
export type NoiseStreamStatus =
  | "initializing"      // 初始化中
  | "quiet"             // 安静
  | "noisy"             // 嘈杂
  | "permission-denied" // 权限拒绝
  | "error";            // 错误
```

---

## 10. 测试覆盖

### 10.1 测试文件列表

| 测试文件 | 测试内容 |
|---------|---------|
| [src/utils/__tests__/noiseScoreEngine.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseScoreEngine.test.ts) | 评分引擎测试 |
| [src/services/noise/__tests__/noiseFrameProcessor.test.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/__tests__/noiseFrameProcessor.test.ts) | 帧处理器测试 |
| [src/services/noise/__tests__/noiseSliceAggregator.test.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/__tests__/noiseSliceAggregator.test.ts) | 切片聚合器测试 |
| [src/services/noise/__tests__/noiseStreamService.test.ts](file:///d:/Desktop/Immersive-clock/src/services/noise/__tests__/noiseStreamService.test.ts) | 流服务测试 |
| [src/utils/__tests__/noiseSliceService.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseSliceService.test.ts) | 切片服务测试 |
| [src/utils/__tests__/noiseHistoryBuilder.test.ts](file:///d:/Desktop/Immersive-clock/src/utils/__tests__/noiseHistoryBuilder.test.ts) | 历史构建测试 |

### 10.2 测试场景

#### 10.2.1 评分引擎测试

- 边界条件测试（最小/最大值）
- 三维度惩罚独立测试
- 综合评分测试
- 有效时长处理测试

#### 10.2.2 帧处理器测试

- RMS 计算正确性
- dBFS 转换正确性
- 峰值检测正确性
- 定时器精度测试

#### 10.2.3 切片聚合器测试

- 统计指标计算正确性
- 分位数计算正确性
- 事件段检测与合并
- 显示分贝映射
- 缺口检测

#### 10.2.4 流服务测试

- 订阅/发布机制
- 生命周期管理
- 设置热更新
- 预热帧处理

#### 10.2.5 切片服务测试

- 读写操作
- 时间窗口清理
- 容量限制
- 数据规范化

#### 10.2.6 历史构建测试

- 课表关联
- 加权平均评分
- 覆盖率计算
- 跨天课时处理

**[问题10] 测试覆盖建议：**
- 浏览器兼容性矩阵（Chrome/Firefox/Safari/Edge/iOS Safari/Android WebView）
- 性能测试（CPU、内存、持续运行对电池的影响）
- 集成/端到端测试（从权限请求到历史生成流程）
- 跨浏览器、移动端、电池/性能测试

---

## 11. 问题汇总与修复建议

### 11.1 严重问题

#### 问题1：缺口阈值文档错误

**位置：** 3.1.7

**问题：** 文档注释写"默认 250ms"，但代码实际是 1000ms

**修复：** 将文档注释改为：
```
**缺口阈值：** `max(1000ms, frameMs × 5)` = **1000ms**（默认）
```

#### 问题2：常量命名容易混淆

**位置：** 3.1.8, 4.1.4

**问题：** `INVALID_DBFS_THRESHOLD = -90` 与 `DBFS_MIN_VALID = -100` 用途不同但命名相似

**修复建议：**
```typescript
// 物理最小可表示值
export const DBFS_MIN_POSSIBLE = -100;
export const DBFS_MAX_POSSIBLE = 0;

// 统计意义上的静音阈值
export const DBFS_SILENCE_THRESHOLD = -90;
```

### 11.2 中等问题

#### 问题4：avgDbfs 计算不严谨

**位置：** 3.1.2

**问题：** 对 dBFS 值做算术平均，应该在线性域（RMS）上做平均

**修复代码：**
```typescript
function computeAvgDbfsFromDbfsArray(dbfsArr: number[]): number {
  if (dbfsArr.length === 0) return DBFS_MIN_POSSIBLE;
  // 在线性能量域求平均
  const meanSquare = dbfsArr.reduce((s, db) => s + Math.pow(10, db / 10), 0) / dbfsArr.length;
  const overallRms = Math.sqrt(meanSquare);
  const avgDbfs = 20 * Math.log10(Math.max(overallRms, 1e-12));
  return Math.max(DBFS_MIN_POSSIBLE, Math.min(DBFS_MAX_POSSIBLE, avgDbfs));
}
```

#### 问题5：分位数在 dB 域计算

**位置：** 3.1.3

**问题：** 从能量统计角度应该在线性域计算分位数

**修复代码：**
```typescript
function computeQuantileFromDbfsArray(dbfsArr: number[], p: number): number {
  if (dbfsArr.length === 0) return DBFS_MIN_POSSIBLE;
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

#### 问题6：overRatioDbfs 帧数占比

**位置：** 3.1.4

**问题：** 使用帧数占比，可以使用时间加权计算

**修复代码：**
```typescript
// 在切片聚合器中记录超阈值时长
let aboveDurationMs = 0;

const isAbove = frame.dbfs > scoreOpt.scoreThresholdDbfs;
if (isAbove) {
  aboveFrames += 1;
  aboveDurationMs += frameMs; // 假设帧间隔固定
}

// 切片完成时计算
overRatioDbfs: aboveDurationMs / sampledDurationMs
```

#### 问题7：默认映射缺乏说明

**位置：** 3.1.6

**问题：** `1e-3 RMS → 60 dB` 是经验值，缺少校准流程说明

**修复建议：** 在文档中补充校准流程：
1. 使用标准声源（如 60 dB 的白噪音）
2. 测量对应的 RMS 值
3. 设置为 baselineRms
4. 设置对应的显示分贝为 baselineDb

### 11.3 建议改进

#### 问题8：浏览器兼容性

**建议：** 在文档中补充浏览器兼容性说明和降级策略

#### 问题9：隐私安全

**建议：** 在文档中补充隐私声明和用户控制选项

#### 问题10：测试覆盖

**建议：** 补充跨浏览器、性能、集成测试

#### 问题11：工具函数定义

**建议：** 在附录中补充工具函数的实现

#### 问题12：时区处理

**建议：** 明确时区策略（本地时区 vs UTC）

#### 问题13：常量命名

**建议：** 补充常量注释，提高可读性

#### 问题14：边界条件

**建议：** 在文档中补充边界条件处理说明

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

### B. 评分与校准分离说明

系统通过"原始数据（用于评分）"与"显示数据（用于展示）"的严格分层，杜绝了校准值导致的评分偏差：

1. **评分只依赖原始 DBFS**
   - 评分的三项核心指标都来自原始 `dbfs` 统计
   - "超阈时长占比"判定条件固定为 `dbfs > scoreThresholdDbfs`
   - 校准值不影响评分

2. **校准仅影响 Display dB**
   - 校准只用于将 `rms` 映射为 `displayDb`
   - 用于实时显示与报告中的"噪音等级分布"
   - 不进入评分链路

3. **统计报告中的"超阈时长"取自 raw.overRatioDbfs**
   - 完全基于 DBFS
   - "噪音等级分布"使用 `display.avgDb`（会随校准变化）

### C. 参数固定策略

为保证统计口径稳定，当前版本将"分析与评分"的高级参数固定为程序内常量：

| 参数 | 值 | 说明 |
|------|-----|------|
| frameMs | 50ms | 约 20fps |
| sliceSec | 30s | 切片时长 |
| scoreThresholdDbfs | -50 dBFS | 评分阈值 |
| segmentMergeGapMs | 500ms | 事件段合并间隔 |
| maxSegmentsPerMin | 6 | 每分钟最大事件段数 |

### D. 相关文档

- [噪音评分系统详解](file:///d:/Desktop/Immersive-clock/docs/noise-scoring.md) - 用户视角的评分说明

---

**文档版本：** 1.1（修订版）
**最后更新：** 2026-02-17
**对应代码版本：** Immersive Clock
**修订说明：** 标注外部审查发现的问题，提供修复建议
