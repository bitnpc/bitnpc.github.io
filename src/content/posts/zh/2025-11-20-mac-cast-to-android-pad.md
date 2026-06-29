---
title: 'Mac 投屏到 Android Pad 的架构实现'
pubDate: 2025-11-20
categories: [技术, 音视频]
tags:
    - 互联互通
    - 投屏
    - VideoToolbox
    - 虚拟显示器
    - VBR
    - HID
toc: true
description: '苹果的 Sidecar（随航）能把 Mac 画面扩展到 iPad 上，并在 iPad 上触控操作 Mac。但 Sidecar 仅限 Apple 生态——能不能在 Android Pad 上实现同样的体验？'
---

## 前言

苹果的 Sidecar（随航）能把 Mac 画面扩展到 iPad 上，并在 iPad 上触控操作 Mac。但 Sidecar 仅限 Apple 生态——能不能在 Android Pad 上实现同样的体验？

本文以小米平板为例，分析 **Mac 作为 Source 端、Android Pad 作为 Sink 端**的投屏架构实现，思路对标 Sidecar。核心挑战：Mac 端如何无感采集屏幕、如何选择编码参数才能在有限带宽内保持流畅、以及 Pad 端的触控如何精确映射回 Mac。

## 一、整体架构

```
┌─ Source 端（Mac）──────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─ 平台层 ──────────────────────────────────────────────────────┐     │
│  │  虚拟显示器 (CGVirtualDisplay) → 屏幕采集 (CGDisplayStream)    │     │
│  │       ↓ IOSurface → CVPixelBuffer → CMSampleBuffer            │     │
│  │  VideoToolbox 硬件编码 (H.265/H.264)                          │     │
│  └────────────────────────────┬──────────────────────────────────┘     │
│                               ▼                                         │
│  ┌─ 投屏传输 SDK (Server 模式) ──────────────────────────────────┐     │
│  │  RTSP + RTP → AES 加密 → MPT 传输层 → 发送                    │     │
│  │  ← 接收 Pad 反馈：丢包率 / IDR 请求                            │     │
│  └──────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Wi-Fi
                                   ▼
┌─ Sink 端（Android Pad）────────────────────────────────────────────────┐
│  ┌─ 投屏传输 SDK (Client 模式) ───────────────────────────────────┐    │
│  │  接收 → 解密 → RTP 重组 → 解码回调                              │    │
│  │  → 向 Source 反馈：丢包率统计 / 请求 IDR                         │    │
│  └────────────────────────────┬─────────────────────────────────────┘    │
│                               ▼                                           │
│  ┌─ 平台层（Android）─────────────────────────────────────────────┐      │
│  │  视频解码（硬解）→ 渲染 → 上屏                                  │      │
│  │  反向控制：触摸采集 → HID 编码 → Protobuf → 投屏传输 SDK 发送    │      │
│  └────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

与 [上篇"手机投屏到 Mac"](/posts/android-screen-mirroring-architecture/) 相反，Mac 在这里是 Source 端——需要完成**屏幕采集**和**编码发送**。

### 投屏传输 SDK

底层使用跨平台的投屏传输 SDK（C++ 实现，Android/macOS/iOS/Windows 共用）。SDK 采用 Server-Client 模型，Mac 端以 **Server 模式**运行：注册视频/音频编码插件 → `setAttribute` 配置编码参数 → 插件输出编码帧后调用 `write()` 发送。Pad 端作为 Client 接收、解码、渲染。SDK 的核心机制在上一篇已有详细分析，本文聚焦 Mac 端特有的设计。Pad 随航场景下音频由 Mac 本地扬声器/耳机播放，未做音频采集传输。

---

## 二、屏幕采集：虚拟显示器

Mac 投屏的核心难题是：怎么在不镜像主屏的情况下，独立采集画面？答案是用 `CGVirtualDisplay` 创建虚拟显示器——这和 Sidecar 的思路一致。

### 2.1 为什么需要虚拟显示器

```
物理显示器 (2560x1440)         虚拟显示器 (1920x1080)
┌─────────────────────┐        ┌──────────────────┐
│                     │        │                  │
│     主屏工作区       │        │  Pad 扩展桌面     │
│                     │        │                  │
└─────────────────────┘        └──────────────────┘
```

直接采集主屏有两个缺陷：分辨率不匹配（主屏 2K/4K，Pad 只需 1080p）；用户窗口操作会干扰投屏内容。虚拟显示器创建了一个独立桌面空间——Mac 自动识别为扩展显示器，Pad 只显示这个虚拟显示器上的窗口，互不干扰。

### 2.2 创建虚拟显示器

macOS 10.13+ 提供了 `CGVirtualDisplay` 私有框架：

```objc
CGVirtualDisplayDescriptor *descriptor = [[CGVirtualDisplayDescriptor alloc] init];
descriptor.name = @"Virtual Display";
descriptor.maxPixelsWide = 3840;
descriptor.maxPixelsHigh = 2160;
descriptor.productID = 0x1234;
descriptor.vendorID = 0x3456;
descriptor.serialNum = 0x0001;

// 物理尺寸按 PPI 计算
CGFloat pixelsPerMillimeter = 110.0 / 25.4;  // 约 110 PPI
descriptor.sizeInMillimeters = CGSizeMake(
    ceil(scaledWidth / pixelsPerMillimeter),
    ceil(scaledHeight / pixelsPerMillimeter));

CGVirtualDisplaySettings *settings = [[CGVirtualDisplaySettings alloc] init];
settings.hiDPI = 1;
settings.modes = @[
    [[CGVirtualDisplayMode alloc] initWithWidth:scaledWidth
                                         height:scaledHeight
                                    refreshRate:60],
    // 降级分辨率
    [[CGVirtualDisplayMode alloc] initWithWidth:scaledWidth * 4 / 5
                                         height:scaledHeight * 4 / 5
                                    refreshRate:60],
];

CGVirtualDisplay *virtualDisplay = [[CGVirtualDisplay alloc] initWithDescriptor:descriptor];
BOOL success = [virtualDisplay applySettings:settings];
CGDirectDisplayID displayID = virtualDisplay.displayID;
```

创建成功后，系统设置中会出现一个虚拟显示器，用户可以拖拽窗口到 Pad 的扩展桌面上。
```alert
type: info
description: `CGVirtualDisplay` 是私有框架，不适合 App Store 提交。Sidecar 使用了更底层的 SidecarCore 框架 + AirPlay 传输，原理类似但实现不同。
```

### 2.3 CGDisplayStream 采集

用 `CGDisplayStream` 从虚拟显示器采集画面，输出格式为 `kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange`（NV12）：

```objc
NSDictionary *options = @{
    (id)kCGDisplayStreamShowCursor: @YES,
    (id)kCGDisplayStreamQueueDepth: @5
};

CGDisplayStreamRef displayStream = CGDisplayStreamCreateWithDispatchQueue(
    displayID,
    width, height,
    kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,  // NV12
    (__bridge CFDictionaryRef)options,
    streamQueue,  // 串行队列
    ^(CGDisplayStreamFrameStatus status,
      uint64_t displayTime,
      IOSurfaceRef frameSurface,
      CGDisplayStreamUpdateRef updateRef) {

        if (status != kCGDisplayStreamFrameStatusFrameComplete || !frameSurface) {
            return;
        }

        // IOSurface → CVPixelBuffer → CMSampleBuffer（零拷贝）
        CVPixelBufferRef pixelBuffer = NULL;
        CVPixelBufferCreateWithIOSurface(kCFAllocatorDefault, frameSurface, NULL, &pixelBuffer);

        CMTime pts = CMTimeMake(CACurrentMediaTime() * 1000000, 1000000);
        CMSampleBufferRef sampleBuffer = NULL;
        CMSampleBufferCreateForImageBuffer(kCFAllocatorDefault, pixelBuffer,
            YES, NULL, NULL, formatDesc, &timingInfo, &sampleBuffer);

        // 回调给编码器
        callback(sampleBuffer);

        CFRelease(sampleBuffer);
        CVPixelBufferRelease(pixelBuffer);
    }];
```

整个链路 `IOSurface → CVPixelBuffer → CMSampleBuffer` 全是零拷贝——共享同一块 GPU 内存，直到 VideoToolbox 编码时才第一次读数据。

### 2.4 镜像模式保护

虚拟显示器自动识别为扩展显示器，但某些场景下系统可能自动切入镜像模式。需要注册 `CGDisplayRegisterReconfigurationCallback` 监听，检测到镜像时强制改回扩展：

```c
// 文件级 static 变量，标记是否正在处理镜像切换（防重入）
static BOOL isHandlingDisplayChange = NO;

// 监听重新配置回调
CGDisplayRegisterReconfigurationCallback(reconfigCallback, (void *)displayID);

static void reconfigCallback(CGDirectDisplayID display,
                             CGDisplayChangeSummaryFlags flags,
                             void *userInfo) {
    CGDirectDisplayID targetID = (CGDirectDisplayID)(uintptr_t)userInfo;
    if (display != targetID || isHandlingDisplayChange) return;

    if (CGDisplayIsInMirrorSet(display)) {
        isHandlingDisplayChange = YES;
        // 强制取消镜像模式
        CGDisplayConfigRef configRef;
        CGBeginDisplayConfiguration(&configRef);
        CGConfigureDisplayMirrorOfDisplay(configRef, display, kCGNullDirectDisplay);
        CGCompleteDisplayConfiguration(configRef, kCGConfigurePermanently);
        isHandlingDisplayChange = NO;
    }
}
```

---

## 三、VideoToolbox 编码引擎

### 3.1 编码链路

```
CGDisplayStream 采集 CMSampleBuffer (NV12)
       ↓
VTVideoEncoder.encodeFrame()
       ↓
VTCompressionSessionEncodeFrame() → 编码输出 CMSampleBuffer (H.264/H.265)
       ↓
processEncodedFrame():
  - 关键帧：插入 SPS/PPS/VPS 参数集
  - AVCC 格式 → Annex-B 格式（长度前缀 → startcode 0x00000001）
       ↓
frameCallback_() → MCServer.write() → 投屏传输 SDK → 网络
```

### 3.2 单 Session + 惰性重建

编码器使用单个 `VTCompressionSession`，初始化时创建、销毁前一直复用。当 Mac 从休眠唤醒导致 GPU 上下文失效时，仅需惰性重建一次：

```cpp
class VTVideoEncoder {
    VTCompressionSessionRef session_{nullptr};

    void encodeFrame(CMSampleBufferRef sampleBuffer) {
        OSStatus status = VTCompressionSessionEncodeFrame(
            session_, pixelBuffer, pts, kCMTimeInvalid, nullptr, nullptr, &infoFlags);

        // 仅 GPU 重置后重建一次，覆盖唯一的异常路径
        if (status == kVTInvalidSessionErr || status == kVTCompressionSessionHardwareError) {
            destroySession(session_);
            createSession(session_);
            status = VTCompressionSessionEncodeFrame(
                session_, pixelBuffer, pts, kCMTimeInvalid, nullptr, nullptr, &infoFlags);
        }
        if (status != noErr) {
            // 丢帧 + 日志，不阻塞采集线程
        }
    }
};
```

投屏场景编码参数固定（虚拟显示器分辨率创建后不变），重建 Session 的概率极低。双 Session 的"零切换"优势没有触发场景，单 Session + 惰性重建更简洁。

### 3.3 编码参数选型

```cpp
void configureEncoderProperties(VTCompressionSessionRef session) {
    // 1. RealTime 模式 — 优先保证编码速度
    VTSessionSetProperty(session, kVTCompressionPropertyKey_RealTime, kCFBooleanTrue);

    // 2. 禁止 B 帧重排 — 消除编码器内部缓冲延迟
    VTSessionSetProperty(session, kVTCompressionPropertyKey_AllowFrameReordering, kCFBooleanFalse);

    // 3. 限制编码器延迟 — 最多保留 1 帧参考
    int32_t maxFrameDelay = 1;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxFrameDelayCount,
        CFNumberCreate(nullptr, kCFNumberSInt32Type, &maxFrameDelay));

    // 4. 关键帧间隔 — 投屏场景静态画面为主，长 GOP 减少关键帧开销
    int32_t gopSize = 15000;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxKeyFrameInterval,
        CFNumberCreate(nullptr, kCFNumberSInt32Type, &gopSize));
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration,
        CFNumberCreate(nullptr, kCFNumberFloatType, (float[]){300.0f}));

    // 5. 编码质量 — 0.7，在画质和编码速度间折衷
    float quality = 0.7;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_Quality,
        CFNumberCreate(nullptr, kCFNumberFloat32Type, &quality));
}
```

### 3.4 VBR 码率策略

使用 VBR（可变码率），根据分辨率动态计算基准码率：

```cpp
// Table-driven — 不同分辨率用不同的 bit/pixel 系数
struct BitrateConfig {
    int maxPixels;
    double hevcFactor;  // H.265 压缩比高，系数更小
    double h264Factor;
};

const BitrateConfig configs[] = {
    {  640*480,  2.5, 4.0 },   // 480p
    { 1280*720,  2.2, 3.5 },   // 720p
    {1920*1080,  2.0, 3.0 },   // 1080p
    {3200*2136,  1.8, 2.8 },   // 3K
    {3840*2160,  1.8, 2.5 },   // 4K
    { INT_MAX,   1.5, 2.0 }    // >4K
};

// 基准码率 = pixelCount × factor
int64_t baseBitrate = static_cast<int64_t>(pixelCount * factor);

// 动态范围：40% ~ 150% 基准码率
int64_t minBitrate = baseBitrate * 0.4;
int64_t maxBitrate = baseBitrate * 1.5;

CFArrayRef range = CFArrayCreate(...);
VTSessionSetProperty(session, kVTCompressionPropertyKey_DataRateLimits, range);
```

以 1080p H.265 为例：`1920 × 1080 × 2.0 = 4,147,200 bps ≈ 4 Mbps`，动态范围 1.6 ~ 6.2 Mbps。

**为什么用 VBR 而非 CBR：**

| 维度 | VBR | CBR |
|------|-----|-----|
| 静态画面 | 码率降低，节省带宽 | 填充无效数据，浪费带宽 |
| 动态画面 | 码率峰值，画质优先 | 画质下降明显 |
| 投屏适用性 | ✅ 最匹配（桌面大部分时间是静态的） | 不推荐 |
| Gop Size 大时 | 码率波动大但未超限 | 平稳但浪费资源 |

投屏画面以静态内容为主（文档、桌面），VBR 的带宽利用率远超 CBR。`DataRateLimits` 的上下限约束保证码率不会失控。

### 3.5 VFR 帧率

编码器使用 VFR（可变帧率）——`kCMTimeInvalid` 作为帧时长，`ExpectedFrameRate = 0`：

```cpp
float frameRate = 0.0f;
VTSessionSetProperty(session, kVTCompressionPropertyKey_ExpectedFrameRate,
    CFNumberCreate(nullptr, kCFNumberFloat32Type, &frameRate));
```

VFR 在桌面投屏场景下优势明显：静止画面时采集端可能跳帧，VFR 允许编码器直接跳过空白帧，不产生额外的 P 帧/码率开销。CFR 则会强制填充帧间隔、浪费带宽。

### 3.6 分辨率自适应（Intel 编码能力兜底）

Apple Silicon 的 Media Engine 硬件编码器性能充足——从 M1 到 M3 Max，单路 1080p@60fps 编码的吞吐能力和延迟几乎一致（差异仅在多路并行）。瓶颈在 Intel 端：低端 Intel 芯片的 Quick Sync 编码器可能无法实时完成 1080p 编码，导致帧率下降。为此根据 Mac 的 CPU 型号动态缩放编码分辨率：

```cpp
void adjustResolutionByCPU(int32_t& width, int32_t& height) {
    auto cpuType = CPUInfo::getCPUType();
    double scale = 1.0;

    if (cpuType <= CPUType::IntelI5)       scale = (width <= 1920) ? 0.8  : 0.73;
    else if (cpuType <= CPUType::IntelI7)  scale = (width <= 2560) ? 0.9  : 0.8;
    // Apple Silicon 全系 Media Engine 性能充足，无需降分辨率

    width  = static_cast<int32_t>(ceil(width * scale));
    height = static_cast<int32_t>(ceil(height * scale));
}
```

| CPU | 1080p 缩放 | 实际编码分辨率 | 原因 |
|-----|-----------|------------|------|
| Intel i5 | 0.8 | 1536×864 | Quick Sync 吞吐上限 |
| Intel i7 | 0.9 | 1728×972 | |
| Apple M1/M2/M3 全系 | 1.0 | 1920×1080 | Media Engine 单路编码无瓶颈 |

### 3.7 AVCC → Annex-B 格式转换

VideoToolbox 输出的编码帧是 AVCC 格式（4 字节长度前缀），投屏传输 SDK 要求 Annex-B（`0x00000001` startcode）：

```cpp
void processEncodedFrame(CMSampleBufferRef sampleBuffer, bool isKeyFrame) {
    static const uint8_t startCode[] = {0x00, 0x00, 0x00, 0x01};
    std::vector<uint8_t> fullPacket;

    // 关键帧：先插入参数集（SPS/PPS/VPS）
    if (isKeyFrame) {
        auto paramSets = getParameterSets(formatDesc);
        for (auto& ps : paramSets) {
            fullPacket.insert(end, startCode, startCode + 4);
            fullPacket.insert(end, ps.begin(), ps.end());
        }
    }

    // NAL 单元：长度前缀 → startcode
    char* data; size_t totalLen;
    CMBlockBufferGetDataPointer(blockBuffer, 0, nullptr, &totalLen, &data);

    size_t offset = 0;
    while (offset < totalLen) {
        uint32_t naluLen;
        memcpy(&naluLen, data + offset, 4);
        naluLen = CFSwapInt32BigToHost(naluLen);  // 大端 → 主机序

        fullPacket.insert(end, startCode, startCode + 4);
        fullPacket.insert(end, data + offset + 4, data + offset + 4 + naluLen);
        offset += 4 + naluLen;
    }

    // 回调投屏传输 SDK
    frameCallback_(fullPacket.data(), fullPacket.size(), pts);
}
```

---

## 四、反控：HID 事件注入

Pad 端的触摸/鼠标/键盘事件通过 Protobuf 编码发送到 Mac，Mac 端解析后用 `CGEvent` 注入系统。

### 4.1 消息格式

控制通道使用 Protobuf 定义消息结构：

```protobuf
message HIDReport {
  oneof input {
    HIDKeyboard   keyboard    = 1;
    HIDMouse      mouse       = 2;
    HIDTouchScreen touch_screen = 3;
    HIDStylus     stylus      = 4;
  }
}

message HIDMouse {
  float x = 1;          // 归一化坐标 (0.0-1.0)
  float y = 2;
  int32 scroll_y = 3;
  enum ButtonFlag {
    NONE  = 0;
    LEFT  = 1;
    RIGHT = 2;
    WHEEL = 3;
    HOVER = 4;
  }
  ButtonFlag button_flag = 4;
}
```

### 4.2 事件路由

Mac 端接收 Protobuf 消息后，根据输入类型路由到不同的事件模拟器：

```
HIDDispatcher.handleHIDReport(report, displayID)
  ├─ has_keyboard()    → KeyboardEventSimulator
  │   └─ Android KeyCode → CGKeyCode 映射 → CGEventPost
  ├─ has_mouse()       → MouseEventSimulator
  │   ├─ 移动           → CGEvent(kCGEventMouseMoved)
  │   ├─ 左键/右键      → CGEvent(kCGEventLeftMouseDown/Up)
  │   ├─ 拖拽           → mouseMoved + isDrag
  │   └─ 滚轮           → CGEventCreateScrollWheelEvent
  ├─ has_touch_screen() → TouchGestureRecognizer
  │   └─ 单手/多指 → tap/doubleTap/scroll/pinch → 映射为鼠标事件
  └─ has_stylus()      → StylusGestureRecognizer
      └─ 触控笔 → 映射为鼠标事件
```

### 4.3 手势识别

TouchGestureRecognizer 将 Pad 端的触摸手势转换为 Mac 端的鼠标操作：

| 手势 | CGEvent 注入 |
|------|-------------|
| 单击 / 双击 / 三击 | `kCGEventLeftMouseDown` + `kCGEventLeftMouseUp` + clickCount |
| 右键 | `kCGEventRightMouseDown` + `kCGEventRightMouseUp` |
| 拖拽 | `kCGEventLeftMouseDown` → `mouseMoved(isDrag: true)` → `kCGEventLeftMouseUp` |
| 移动（单点） | `kCGEventMouseMoved` |
| 滚轮 | `CGEventCreateScrollWheelEvent` |
| 双指缩放 | `kVK_ANSI_Equal` / `kVK_ANSI_Minus`（Command +/-） |
```alert
type: info
description: **双指缩放的局限**：macOS 10.5+ 提供了 `NSEventTypeMagnify` 手势事件和 `kCGGesturePhase` 相位字段，理论上用 `CGEventCreateScrollWheelEvent` + 手势相位可以模拟触控板的连续缩放。但实际测试发现，程序化构造的 CGEvent 在转换为 `NSEvent` 的过程中会经过 AppKit 的事件源校验——不同 App 行为不一致，连续缩放在多数 App 中无法稳定触发。`Cmd +/-` 作为**键盘快捷键**在所有 App 中行为可预测，是当前场景下的可靠保底方案。
```

### 与 Sidecar 的对比

Sidecar 能在 Mac 端支持流畅的触控板级手势（双指缩放、旋转、滚动），是因为它走了更高权限的事件通道：iPad 端原始触摸数据通过 `SidecarCore` 私有框架传输，Mac 端接收后由 OS 重建 `NSTouch` 对象（`NSTouchTypeDirect`），直接进入 AppKit 的手势识别管道。App 通过 `NSMagnificationGestureRecognizer` 和 `NSRotateGestureRecognizer` 接收——与内置触控板完全一致。

我们的路径不同——Pad 触摸数据通过 Protobuf 经投屏传输 SDK 到达 Mac，只能走 `CGEventPost` 注入鼠标/键盘事件。`NSTouch` 没有公开的初始化方法，无法从外部构造合法的触摸对象。这是 OS 权限层面的差距，不是传输协议能解决的。

| 维度 | Sidecar | 本方案 |
|------|---------|--------|
| 触摸数据传输 | SidecarCore 私有通道 | Protobuf over 投屏传输 SDK |
| Mac 端事件类型 | `NSTouch` (Direct) | `CGEvent` (Mouse/Keyboard) |
| 双指缩放 | `NSMagnificationGestureRecognizer`（连续） | Cmd +/- 快捷键（步进） |
| 双指旋转 | `NSRotateGestureRecognizer` | 不支持 |
| 手势连续性 | 离散（单次 `.ended` 回调） | N/A（非手势 API） |
| 代码部署目标 | 需要 App 添加手势识别器 | 无需 App 适配，系统级生效 |

### 4.4 坐标映射

Pad 端发送归一化坐标 (0.0-1.0)，Mac 端映射到虚拟显示器的实际像素位置：

```objc
CGPoint convertPointToScreen(CGPoint normalizedPoint,
                             NSScreen *currentScreen,
                             NSScreen *innerScreen) {
    NSRect screenFrame = currentScreen.frame;
    return CGPointMake(
        screenFrame.origin.x + normalizedPoint.x * screenFrame.size.width,
        innerScreen.frame.size.height - screenFrame.origin.y
            - normalizedPoint.y * screenFrame.size.height
    );
}
```

y 坐标需要翻转——Pad 坐标系原点在左上，macOS 在左下。

### 4.5 多点触控限制

最多处理 3 个触摸点：

```objc
int size = MIN(report.touch_screen().inputs_size(), 3);
```

限制原因：Pad 端切换 App 时可能出现"多指按下但没有全部抬起"的异常状态，不限制会积压未消费的手势事件。

---

## 五、踩坑记录

### 屏幕采集方案演进

macOS 上录制虚拟显示器画面有两种方案：

| 方案 | API | 优点 | 缺点 |
|------|-----|------|------|
| AVCaptureScreenInput | `AVCaptureSession` + `AVCaptureScreenInput` | 系统级采集，自动色彩管理 | 强制镜像模式触发黑屏 |
| CGDisplayStream | `CGDisplayStreamCreateWithDispatchQueue` | 零拷贝 IOSurface，不走窗口合成器 | 需手动管理格式转换 |

最初尝试了 `AVCaptureScreenInput` 方案，但发现虚拟显示器在某些 macOS 版本下会触发黑屏——AVCapture 内部会试图重新配置显示器模式。最终改为 `CGDisplayStream` 直接从 IOSurface 读取帧，避开了系统级采集的副作用，延迟也更低（零拷贝）。

### 编码性能优化：130ms → 14ms

编码器上线初期，M3 Pro 上实测编码延迟高达 130ms，帧率仅 28FPS。排查后发现两个关键问题：

**1. `kVTCompressionPropertyKey_EnableLowLatencyRateControl` 阻塞编码管道。** 该参数在 Apple Silicon 上反而限制了硬件编码器吞吐——移除此限制后延迟从 130ms 降至约 50ms。

**2. `CGDisplayStream` 的 `QueueDepth = 5` 导致 5 帧缓冲延迟。** 降低到 1，采集帧直接送入编码器，中间无排队——延迟从 50ms 进一步降至 14ms。

最终性能：M3 Pro 上 57FPS @ 1080p H.265，编码延迟中位数 14ms，GPU 使用率 26%（确认硬件加速工作）。

### 长 GOP 策略

桌面投屏大部分时间是静态画面（文档、代码编辑器、桌面）。每 60 帧一个 IDR 意味着每隔 1 秒发一个超大的关键帧（数倍于 P 帧），静态场景下纯浪费带宽。拉长到 15000 帧（约 250 秒），编码器在无画面变化时几乎不生产 IDR，码率平稳、画面流畅。局域网 Wi-Fi 丢包率极低（<0.1%），Jitter Buffer 能处理偶发丢包，不需要频繁 IDR 做丢包恢复。

### 反控触控采样率降频

与上篇"手机投屏到 Mac"类似，Pad 端的触摸采样率（120-240Hz）远高于 Mac 端 CGEvent 注入的消费能力。`mouseDragged` 事件全量发送后会在事件队列排队，导致操作延迟。方案：在 Pad 端将触控滑动事件采样率降至四分之一，平衡流畅度与响应延迟。

### iPhone Mirroring 与 Pad 反控嵌套卡顿

macOS Sequoia 引入了 iPhone Mirroring——Mac 上出现一个 iPhone 镜像窗口。当用户用 Pad 反控 Mac 时，如果触控落在 iPhone Mirroring 窗口内，会形成两层嵌套：Pad 触控 → Mac CGEvent → iPhone Mirroring（又一层触控注入 iPhone）→ 两层的触控采样率和事件队列叠加，延迟放大。根因还是触控采样率——Pad 端高频 CGEvent 注入经过 iPhone Mirroring 二次转发后，内部触控管道堆积更严重。当前解决方案是 Pad 端统一降采样，优先保证基础场景流畅。

### Pad 熄屏唤醒后黑屏

Pad 端熄屏一段时间后重新点亮，投屏画面黑屏。原因是 Pad 端解码器在熄屏期间被系统释放，唤醒后重建解码上下文时没有 IDR 帧——Mac 端编码器对此毫不知情，继续正常发送 P 帧，Pad 解码器缺少关键帧无法重建参考图像，画面冻结。

修复：Pad 端在唤醒后通过投屏传输 SDK 的控制通道向 Mac 端发送 IDR 请求，触发 `MCVideoPlugin::onRequestIDR()`：

```cpp
int32_t MCVideoPlugin::onRequestIDR() {
    if (encoder_ && isEncoding_) {
        videoCapture_->requestIDRFrame();
        encoder_->requestIDRFrame();
        return 0;
    }
    return -1;
}
```

Mac 编码器收到请求后，下一帧强制输出 IDR（携带 SPS/PPS/VPS）。Pad 解码器收到完整参数集 + 关键帧后重建解码上下文，画面立即恢复。

### 录屏授权拒绝后无法重新弹窗

首次启动录屏时，macOS 会弹出系统授权弹窗请求"屏幕录制"权限。如果用户首次拒绝，下次再调用 `CGDisplayStreamStart` 不会再弹出系统授权提示——系统会静默返回授权失败，应用层面拿不到任何画面，也没有再次引导用户的入口。

macOS 的授权机制决定：一旦用户对某个权限做出选择（允许/拒绝），系统不会再主动弹窗，只能由用户手动到"系统设置 > 隐私与安全性 > 屏幕录制"中开启。因此应用需要自己检测授权状态并引导：

```objc
// 检测屏幕录制授权状态
BOOL hasPermission = CGPreflightScreenCaptureAccess();

if (!hasPermission) {
    // 已被拒绝过（或未选择）→ 弹出自定义弹窗引导用户去系统设置开启
    [self showCustomPermissionAlert:^{
        [[NSWorkspace sharedWorkspace] openURL:
            [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"]];
    }];
} else {
    // 已授权，正常启动采集
    [self startCapture];
}
```

`CGPreflightScreenCaptureAccess()` 仅检测不触发弹窗，`CGRequestScreenCaptureAccess()` 才会触发首次系统弹窗——但只在用户从未做过选择时有效。被拒绝后只能靠自定义弹窗 + 跳转系统设置引导用户手动开启。投屏类应用上线前必须处理好这条路径，否则用户首次拒绝后基本无法自救。

### 镜像模式冲突

虚拟显示器创建后，Mac 会将其识别为独立的扩展屏幕。但有一个可复现的场景：Mac 连接外接显示器后断开——此时系统失去显示输出目标，会尝试把画面镜像到虚拟显示器上（`CGDisplayIsInMirrorSet` 返回 true），导致投屏画面异常。

修复：注册 `CGDisplayRegisterReconfigurationCallback` 监听显示状态变化，检测到虚拟显示器进入镜像模式时，调用 `CGConfigureDisplayMirrorOfDisplay(display, kCGNullDirectDisplay)` 强制切回扩展模式。失败时延迟重试，不阻断主流程。

---

## 六、总结

Mac 投屏到 Android Pad 的架构与常见的"手机投屏到 PC"方向相反，核心差异在 Mac 端：

1. **虚拟显示器**：CGVirtualDisplay 创建独立桌面空间，CGDisplayStream 零拷贝采集
2. **编码引擎**：VideoToolbox 硬件编码，VBR + VFR 适配桌面投屏场景，单 Session + 惰性重建覆盖异常路径
3. **Intel 编码兜底**：Apple Silicon 全系 Media Engine 性能充足，仅对 Intel 低端芯片动态降分辨率
4. **反控注入**：Protobuf 消息 → 手势识别 → CGEvent 注入系统，覆盖触摸/鼠标/键盘/触控笔
