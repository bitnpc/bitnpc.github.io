---
title: 'Android 手机投屏到 Mac/iPhone 的架构实现'
pubDate: 2025-10-13
categories: [音视频]
tags:
  - 投屏
  - Metal
  - Android

toc: true
description: '手机投屏是一项常见的需求：把 Android 手机的画面实时投射到电脑（Mac）或平板（iPad/iPhone）上，用于演示、远程协助或多媒体分享。实现一个低延迟、高流畅度的投屏方案，需要覆盖从手机端的屏幕采集编码、网络传输、到接收端的解码渲染全链路。'
---

## 前言

手机投屏是一项常见的需求：把 Android 手机的画面实时投射到电脑（Mac）或平板（iPad/iPhone）上，用于演示、远程协助或多媒体分享。实现一个低延迟、高流畅度的投屏方案，需要覆盖从手机端的屏幕采集编码、网络传输、到接收端的解码渲染全链路。

本文以小米手机的妙享桌面投屏方案为例，从架构视角分析两大核心能力的实现：**镜像投屏（Screen Mirroring）** 和**反向控制（Reverse Control）**。

## 一、整体架构

### 端到端数据流

```
┌─ Source 端（手机）──────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─ 平台层（Android）──────────────────────────────────────────────┐    │
│  │  屏幕采集 (MediaProjection)                                     │    │
│  │       ↓                                                         │    │
│  │  硬件编码器 (MediaCodec)                                        │    │
│  │  H.264/H.265 │ 1080p@60fps │ 8Mbps │ IDR 响应                  │    │
│  │       ↓                                                         │    │
│  │  编码帧回调 → NAL 分片                                          │    │
│  └───────┬─────────────────────────────────────────────────────────┘    │
│          ▼                                                              │
│  ┌─ 投屏传输 SDK (Source 模式) ────────────────────────────────────┐    │
│  │  AES 加密 → RTP 打包（序列号 + timestamp）→ UDP/TCP 发送        │    │
│  │  ← 接收 Sink 反馈：丢包率 / IDR 请求 / 码率调整                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ Wi-Fi 局域网
                                   ▼
┌─ Sink 端（Mac / iPhone / Pad）───────────────────────────────────────────┐
│  ┌─ 投屏传输 SDK (Sink 模式) ─────────────────────────────────────────┐  │
│  │  UDP/TCP 接收 → RTP 重组 → AES 解密 → 按媒体类型回调分发           │  │
│  │  → 向 Source 反馈：丢包率统计 / 请求 IDR / 建议码率                 │  │
│  └────────────────────────────────┬────────────────┬──────────────────┘  │
│                                   │ 视频数据回调    │ 音频数据回调         │
│                                   ▼                ▼                     │
│  ┌─ 平台层（Mac/iPhone 各自实现）──────────────────────────────────────┐  │
│  │  VideoDecoder（VideoToolbox）→ RenderManager → Metal 渲染       │  │
│  │  AudioDecoder（PCM/AAC）→ AudioQueue 播放                        │  │
│  │  反向控制：事件采集 → 30Hz 节流 → 指令编码 → UDP → 手机端注入       │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

数据流包含两条通道：**媒体通道**（手机→接收端，视频/音频）和**控制通道**（接收端→手机，触控指令）。投屏传输 SDK 在两端对称运行——Source 端负责加密打包发送，Sink 端负责接收解密后回调裸音视频数据给平台层处理。同一套 SDK 支撑"手机→Mac"、"手机→iPhone"、"手机→Pad"等多种投屏组合。

### 投屏传输 SDK

整个投屏系统的底座是一套**跨平台投屏传输 SDK**（C++ 实现，Android / macOS / iOS / Windows 共用）。该 SDK 同时运行在 Source 和 Sink 端，封装了连接建立、协议解析、加解密和媒体数据传输，通过插件机制向上层暴露编解码回调。传输层基于 **RTSP + RTP**，自研的 MPT 传输模块支持 UDP/TCP 降级和多链路切换。第三章将详细展开其设计。

---

## 二、Source 端：手机编码与发送

```
┌─────────────────────────────────────────────────────────────┐
│  Android 平台层                                              │
│                                                             │
│  MediaProjection（屏幕采集）                                 │
│       ↓ Surface                                             │
│  MediaCodec（硬件编码器）                                    │
│       │  H.264/H.265  │  配置：分辨率/帧率/码率/Profile      │
│       ↓ 编码帧回调                                           │
│  NAL 分片处理                                                │
│       ↓                                                     │
├─────────────────────────────────────────────────────────────┤
│  投屏传输 SDK                                                │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────────┐  │
│  │ AES 加密  │ →  │ RTP 打包  │ →  │ UDP/TCP 发送          │  │
│  └──────────┘    └──────────┘    └───────────────────────┘  │
│       ↑                                                     │
│  码率调整 / IDR 请求（来自 Sink 端反馈）                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 编码参数选型

```cpp
struct EncoderConfig {
    CodecType codec = CodecType::H265;  // 默认 H.265，旧设备降级 H.264
    int width = 1920;
    int height = 1080;
    int fps = 60;
    int bitrate = 8 * 1000 * 1000;  // 8 Mbps
    int profile;
    int level;
};
```

**H.264 vs H.265 的选择：**

| 对比         | H.264            | H.265         |
| ------------ | ---------------- | ------------- |
| 硬件兼容性   | 几乎所有设备支持 | 较新设备支持  |
| 同等画质码率 | 基准             | 降低约 30-50% |
| 编码延迟     | 较低             | 略高          |
| 解码复杂度   | 低               | 高            |

策略：默认使用 H.265 以获得更低码率（同等画质下约降低 30-50%），仅对 iPad mini 4、iPad Air 2 等旧设备强制降级到 H.264 保证兼容。分辨率和帧率根据网络状况动态调整——网络良好时 1080p@60fps，网络波动时降级到 720p@30fps。

### 2.2 数据打包与发送流程

编码器输出的压缩帧经过以下流水线到达网络：

```
编码器输出 NAL 单元
       ↓
  NAL 分片与封装
       ↓
  RTP 打包（序列号 + timestamp）
       ↓
    AES 加密
       ↓
  ┌────┴────┐
  │ 网络状况 │
  └────┬────┘
 正常 ↙     ↘ 严重丢包
UDP 发送    TCP 发送
```

**NAL 分片：** 一帧 H.264 数据可能超过 UDP 的 MTU（1500 字节），需要分片。接收端根据 RTP 序列号重组完整帧。

**RTP 协议：** 序列号用于检测丢包和排序，timestamp 携带帧的采集时间，接收端据此计算播放时间戳和抖动缓冲。

**AES 加密：** 所有视频载荷加密，确保投屏内容在局域网内不被窃听。

```cpp
class MediaSender {
public:
    void sendEncodedFrame(const uint8_t* data, size_t size, int64_t pts) {
        auto fragments = fragmentNAL(data, size);

        for (auto& frag : fragments) {
            RTPPacket packet;
            packet.sequenceNumber = nextSequenceNum_++;
            packet.timestamp = toRTPTimestamp(pts);
            packet.payload = encrypt(frag.data, frag.size);

            if (useTCP_) {
                sendTCP(packet.data(), packet.size());
            } else {
                sendUDP(packet.data(), packet.size());
            }
        }
    }

    void onNetworkDegraded() {
        useTCP_ = true;
        encoder_.setBitrate(bitrate_ / 2);
    }

private:
    uint16_t nextSequenceNum_{0};
    bool useTCP_{false};
};
```

### 2.3 编码器的事件回调

- **关键帧请求（IDR Request）：** 接收端检测到丢包或解码异常时，请求手机发送关键帧恢复画面
- **码率变化通知：** 网络带宽变化时，通知编码器调整目标码率
- **编码异常：** 硬件故障或资源不足的异常处理

---

## 三、投屏传输 SDK

投屏系统最底层是一套跨平台的 C++ SDK，同时运行在 Android（Source）和 macOS/iOS（Sink）上。SDK 封装了协议解析、网络传输、加解密和会话管理，对上层暴露统一的插件接口和选项配置。

### 3.1 双端角色与插件机制

SDK 采用 Server-Client 模型，两端接口对称但职责不同：

```
┌─ Source 端 ─────────────────────────────┐  ┌─ Sink 端 ───────────────────────────────┐
│                                          │  │                                          │
│  IMiPlayCastMirrorServer (C++ 接口)       │  │  IMiPlayCastMirrorClient (C++ 接口)      │
│                                          │  │                                          │
│  • attachSurface(surface)  绑定采集 Surface│  │  • attachSurface(surface) 绑定渲染 Surface│
│  • setAttribute(type, val) 设置编码参数   │  │  • setAttribute(type, val) 设置解码参数  │
│  • registerVideoPlugin(p)  注册编码回调    │  │  • registerVideoPlugin(p) 注册解码回调   │
│  • registerAudioPlugin(p)  注册音频回调    │  │  • registerAudioPlugin(p) 注册音频回调   │
│  • registerStateCallback() 注册状态回调    │  │  • registerStateCallback() 注册状态回调  │
│  • write(type, data, len, pts) 发送编码帧  │  │  • start(uri) / stop() 控制会话          │
│  • start(uri) / stop() 控制会话           │  │  • pause(mediaType) / resume() 媒体控制  │
│                                          │  │                                          │
└──────────────────────────────────────────┘  └──────────────────────────────────────────┘
```

SDK 通过**插件接口**与上层解码/渲染逻辑解耦。上层只需实现 `MediaPlugin` 接口并注册：

```cpp
class MediaPlugin {
public:
    virtual int32_t onInit(MediaAttribute attr) = 0;  // 传入协商后的媒体参数
    virtual int32_t onStart() = 0;
    virtual int32_t onStop() = 0;
    virtual int32_t onPause() = 0;
    virtual int32_t onResume() = 0;
    virtual int32_t onChangeMediaAttribute(int32_t type, MediaAttribute attr) = 0;
};
```

编解码参数通过 `setAttribute()` 预设，SDK 在连接建立后与对端协商，协商结果通过 `onInit()` 的 `MediaAttribute` 结构体回调给插件：

```cpp
struct MediaAttribute {
    int32_t width;        // 视频宽
    int32_t height;       // 视频高
    int32_t fps;          // 帧率
    int8_t  format[50];   // 编码格式字符串 (video/avc 等)
    int32_t profile;      // Profile
    int32_t level;        // Level
    int32_t bitrate;      // 码率 (bps)
    int32_t channels;     // 音频通道数
    int32_t sampleBits;   // 音频采样位宽
    int32_t sampleRate;   // 音频采样率
};
```

### 3.2 状态回调与会话生命周期

SDK 通过 `StateCallback` 接口向外报告连接状态和数据到达：

```cpp
class StateCallback {
public:
    virtual void onStarted(int32_t localPort) = 0;           // Server 端启动成功
    virtual void onConnected() = 0;                          // 连接建立
    virtual void onDisconnected() = 0;                       // 连接断开
    virtual void onPlayed(int32_t status) = 0;               // 媒体开始播放
    virtual void onError(int32_t what, int32_t extra) = 0;   // 错误
    virtual void onInfo(int32_t what, int64_t extra) = 0;    // 信息通知
    virtual int32_t onReceiveData(int32_t mediaType,         // 收到媒体数据
                                   int8_t* data, int32_t len, int64_t pts) = 0;
};
```

一次完整的投屏会话从连接到播放：

```
Server.start(uri)                                        Client.start(uri)
       │                                                       │
       ▼                                                       ▼
  连接建立 ─────────── TCP 握手 / RTSP 信令 ─────────────→ 连接建立
       │                                                       │
       ▼                                                       ▼
onStarted(localPort)                                   onConnected()
       │                                                       │
       ▼                                                       ▼
 加密协商 ──────────── AES key/iv 交换 ─────────────────→ 加密协商
       │                                                       │
       ▼                                                       ▼
registerMediaPlugin()                                 registerMediaPlugin()
       │                                                       │
       ▼                                                       ▼
  start 数据流 ──────── RTP over UDP ─────────────────→ onReceiveData()
       │                                                     → plugin.onInit(attr)
       │                                                     → plugin.onStart()
       ▼                                                       ▼
onPlayed(0)                                           onPlayed(0)
```

### 3.3 传输协议

SDK 基于 **RTSP + RTP** 协议栈，在标准的 RTP 层之上做了扩展：

```
应用数据层：编码后的 H.264/H.265 视频帧 / PCM/AAC 音频帧
     ↓
RTP 封装层：序列号 + timestamp + 负载类型标识
     ↓
自定义传输层 (MPT)：UDP 优先，支持 TCP 降级和天琴通道
     ↓
物理链路：Wi-Fi / P2P / 蓝牙
```

RTP 序列号用于丢包检测和乱序重排，timestamp 将帧还原到采集时间线——这是 Jitter Buffer 的基础。

**天琴通道（Lyra Channel）：** SDK 还支持通过"天琴"链路传输——手机和接收端之间可以通过蓝牙、自组网 WLAN 或远端转发通道交换 RTP/RTSP 数据，无需同在局域网。`Option_UseLyraChannel` 控制使用哪种底层链路。这一机制进一步扩展了投屏的使用场景。

### 3.4 参数协商与码率自适应

编码参数不是由一端单方面决定，而是通过 `setAttribute()` 预设后，SDK 在连接建立阶段与对端协商：

```
Source 端 setAttribute()                  Sink 端 setAttribute()
  VideoWidth  = 1920                       VideoWidth  = 1920
  VideoFps    = 60                         VideoFps    = 60
  VideoEncType = H265                      VideoEncType = H264  ← Sink 侧偏好 H.264
  VideoBitrate = 8M
       │                                        │
       └──────── 协商结果 ───────────────────────┘
                     VideoEncType = H264  (取交集，Sink 不支持降级)
                     其余参数取最小值
                     → 通过 onInit(attr) 告知上层
```

SDK 内置码率自适应（`Option_EnableAdptiveFun`），运行时根据 RTP 丢包率反馈动态调整编码码率，无需上层干预核心逻辑，上层只需通过 `onInfo()` 感知调整事件。

### 3.5 加密体系

SDK 的加密是分层的：

| 层       | 配置项                           | 说明                             |
| -------- | -------------------------------- | -------------------------------- |
| 加密类型 | `ENCRYPTION_TYPE_AES` / `SMS4`   | 选择加密算法                     |
| 加密级别 | `AESCBC128` / `192` / `256`      | AES 密钥长度                     |
| 加密范围 | `FORMAT_VIDEO` / `AUDIO` / `CMD` | 可选择只加密视频、音频或控制指令 |
| 传输加密 | `ENCRYPTION_TRANSLEVEL_XOR`      | 密钥传输时额外 XOR 保护          |
| 完整性   | `SHA256` / `SHA128` / `MD5`      | 数据完整性校验                   |

加密密钥（`key` + `iv`）和鉴权密钥（`authKey`）由上层在 `start()` 前通过 `setAttribute()` 注入。加解密在 SDK 内部透明完成，上层拿到的音视频数据是解密后的明文。

---

## 四、Sink 端：接收、解码与渲染

Sink 端是整个系统最复杂的部分。内部架构：

```
┌─ SDK 协议层 ──────────────────────────────────────────────┐
│  UDP/TCP 接收 → AES 解密 → RTP 重组 → 媒体类型分发        │
└────────────────────────────┬─────────────┬────────────────┘
                             │ 视频        │ 音频
┌─ 编解码引擎层 ─────────────▼─────────────▼────────────────┐
│                                                           │
│  VideoDecoder (VideoToolbox)   AudioDecoder (PCM/AAC)        │
│       ↓                          ↓                        │
│  RenderManager                AudioPlayer                 │
│  (Jitter Buffer/帧调度)       (AudioQueue 环形缓冲)        │
│       ↓                                                   │
├───────┼───────────────────────────────────────────────────┤
│       ↓              UI 渲染层                             │
│  MetalRenderView（YUV→RGB / 零拷贝）                       │
└───────────────────────────────────────────────────────────┘
```

### 4.1 SDK 协议层

```cpp
class SessionClient {
public:
    void registerStateCallback(StateCallback* cb);
    void registerVideoPlugin(VideoPlugin* plugin);
    void registerAudioPlugin(AudioPlugin* plugin);

    int start(const char* uri, const SessionConfig& config);
    int stop();
    int pause();
    int resume();

    int setAttribute(AttributeType type, int value);

private:
    void receiveLoop();
    void decryptAndDispatch(const uint8_t* data, size_t size);
};
```

协议层通过回调模式分发数据：收到视频数据调用 `VideoPlugin::write()`，收到音频数据调用 `AudioPlugin::write()`，连接状态变化通过 `StateCallback` 上报。

SDK 内置了第一级 Jitter Buffer（配置 `JitterBufferSetEnable = 1`，缓冲阈值 `BufferingThreshold = 200ms`），在网络接收层吸收抖动，回调给引擎层的帧已经按 PTS 重新排序。引擎层的 `RenderManager` 是第二级 Jitter Buffer，控制解码帧的渲染时机。

### 4.2 视频解码引擎

视频解码器基于 VideoToolbox 硬件加速，FFmpeg 软解作为降级备用：

```cpp
class VideoDecoder {
public:
    int onInit(MediaAttribute attr);
    int onStart();
    int onStop();

    int write(const uint8_t* data, size_t size, int64_t pts);
    void setFrameCallback(FrameDecodedCallback cb);

private:
    void decodeLoop();

    RenderManager renderManager_;
    std::unique_ptr<NativeVTDecoder> nativeVTDecoder_;
};

class NativeVTDecoder {
public:
    int init(int width, int height, CodecType codec) {
        // 从码流 SPS/PPS 构造 CMVideoFormatDescription
        CMVideoFormatDescriptionCreateFromH264ParameterSets(
            nullptr, paramCount, paramPointers, paramSizes, 4,
            &formatDescription_);

        // 创建 VTDecompressionSession
        VTDecompressionOutputCallbackRecord callback{&onFrameDecoded, this};
        return VTDecompressionSessionCreate(
            nullptr, formatDescription_, decoderSpec,
            destImageBufferAttributes, &callback, &session_);
    }

    int decode(const uint8_t* data, size_t size, int64_t pts) {
        // Annex-B startcode → AVCC 长度前缀格式转换
        auto avccData = convertAnnexBToAVCC(data, size);

        // 构造 CMSampleBuffer 提交解码
        CMBlockBufferRef blockBuffer;
        CMBlockBufferCreateWithMemoryBlock(nullptr, avccData.data(),
            avccData.size(), kCFAllocatorNull, nullptr, 0,
            avccData.size(), 0, &blockBuffer);

        CMSampleBufferRef sampleBuffer;
        CMSampleBufferCreate(nullptr, blockBuffer, true, nullptr,
            nullptr, formatDescription_, 1, 1, &timingInfo,
            0, nullptr, &sampleBuffer);

        VTDecompressionSessionDecodeFrame(session_, sampleBuffer,
            kVTDecodeFrame_EnableAsynchronousDecompression, nullptr, nullptr);

        CFRelease(sampleBuffer);
        CFRelease(blockBuffer);
        return 0;
    }

private:
    static void onFrameDecoded(void* refCon, void*,
                                OSStatus status, VTDecodeInfoFlags,
                                CVImageBufferRef imageBuffer,
                                CMTime pts, CMTime) {
        auto* self = static_cast<NativeVTDecoder*>(refCon);
        if (status == noErr && self->frameCallback_) {
            self->frameCallback_(imageBuffer, CMTimeGetSeconds(pts));
        }
    }

    VTDecompressionSessionRef session_{nullptr};
    CMVideoFormatDescriptionRef formatDescription_{nullptr};
    FrameCallback frameCallback_;
};
```

解码器初始化时从码流 SPS/PPS 构造 `CMVideoFormatDescription`，创建 `VTDecompressionSession`。接收到的编码数据需做 **Annex-B → AVCC 格式转换**（将 `0x00000001` 起始码替换为 4 字节长度前缀），封装为 `CMSampleBuffer` 后提交给 VideoToolbox 异步解码。解码完成的 `CVPixelBuffer` 通过回调推入 `RenderManager` 等待渲染调度。

解码流水线核心代码路径：

```
解码线程 receiveLoop():
    ├─ put(AVPacket) → 入待解码队列
    ├─ decodeLoop(): 从队列取包
    │   └─ NativeVTDecoder.decode() → VTDecompressionSessionDecodeFrame()
    └─ onFrameDecoded() 回调 → RenderManager.addFrame()
```

解码线程独立运行，与渲染线程通过帧队列解耦（详见[踩坑记录](#其他典型问题)）。

### 4.3 帧调度与渲染管理

帧调度器是控制**延迟与流畅度平衡**的核心：

```cpp
class RenderManager {
public:
    void addFrame(int64_t index, int64_t pts);
    int64_t render();  // 返回下次渲染的等待时间（μs）
    uint32_t forceRender();
    void updateJitterBuffer(int32_t bufferMs, int64_t currentTime);
    void setRefreshRate(int rate);

    using RenderCallback = std::function<void(int64_t pts, int64_t localTime, bool dropped)>;
    void setRenderCallback(RenderCallback cb);

private:
    struct FrameInfo {
        int64_t index;
        int64_t pts;
        int64_t decodeClock;
        int64_t renderClock;
    };

    std::deque<FrameInfo> pendingFrames_;
    int64_t lastRenderTime_{0};
    int64_t recommendMinus_{0};        // 推荐的渲染提前量
    int64_t vsyncInterval_{16000};     // V-Sync 间隔（μs, ~60fps）
    int64_t maxRenderDelayUs_{70000};  // 最大容忍渲染延迟
    int maxRenderCache_{0};
};
```

**核心调度逻辑：**

```cpp
int64_t RenderManager::render() {
    if (pendingFrames_.empty()) return emptyWaitTime_;

    auto& frame = pendingFrames_.front();
    int64_t now = currentTimeMicros();
    int64_t targetTime = frame.pts + recommendMinus_;

    // 队列积压：丢弃旧帧，只保留最新
    if (maxRenderCache_ > 0 && pendingFrames_.size() > maxRenderCache_) {
        while (pendingFrames_.size() > 1) {
            pendingFrames_.pop_front();
            dropCount_++;
        }
    }

    // 帧已过期太久：丢弃
    if (now - targetTime > maxRenderDelayUs_) {
        pendingFrames_.pop_front();
        dropCount_++;
        return 0;  // 立即检查下一帧
    }

    // 未到渲染时间：等待
    if (now < targetTime) return targetTime - now;

    // 渲染
    pendingFrames_.pop_front();
    renderCallback_(frame.pts, now, false);
    return vsyncInterval_;
}
```

**关键设计决策：**

- **丢帧策略**：队列积压时优先丢弃旧帧保留新帧——投屏显示的是"当前画面"而非"流畅回放"
- **两级 Jitter Buffer**：SDK 层做第一级缓冲（200ms 阈值，吸收网络抖动、重排乱序帧），引擎层做第二级控制（根据渲染进度动态调整）。抖动大时增大 buffer（用延迟换流畅），抖动小时减小 buffer（降低延迟）
- **V-Sync 对齐**：渲染时机对齐屏幕刷新信号，减少画面撕裂

### 4.4 Metal 硬件渲染

解码器输出 `CVPixelBuffer` 后需要上屏显示。Apple 平台有两种方案：直接用 `AVSampleBufferDisplayLayer`（系统托管渲染），或用 Metal 自己控制渲染。

| 维度       | Metal 自渲染           | AVSampleBufferDisplayLayer   |
| ---------- | ---------------------- | ---------------------------- |
| 渲染时机   | 完全自控（配合 VSync） | 系统内部缓冲队列，延迟不可控 |
| 丢帧策略   | 自定义（丢旧保新）     | 系统决定，无法干预           |
| 色彩空间   | 自己写 YUV→RGB shader  | 系统自动处理                 |
| 代码复杂度 | 高                     | 低（几行 enqueue 代码）      |

投屏是延迟敏感场景，核心需求是**自己决定"什么时候渲染哪一帧"**。网络抖动导致帧积压时，需要丢掉旧帧只显示最新画面——这在 `AVSampleBufferDisplayLayer` 中无法实现（它按 PTS 顺序平滑播放，适合视频播放器，不适合实时投屏）。因此选择 Metal 自渲染。

Metal 渲染视图通过 `CVMetalTextureCache` 实现零拷贝上屏：

```swift
class MetalRenderView {
    private var device: MTLDevice!
    private var commandQueue: MTLCommandQueue!
    private var pipelineState: MTLRenderPipelineState!
    private var textureCache: CVMetalTextureCache!
    private var metalLayer: CAMetalLayer!

    func setupMetal() {
        device = MTLCreateSystemDefaultDevice()
        commandQueue = device.makeCommandQueue()

        metalLayer = CAMetalLayer()
        metalLayer.device = device
        metalLayer.pixelFormat = .bgra8Unorm

        // CVMetalTextureCache：零拷贝的关键
        CVMetalTextureCacheCreate(kCFAllocatorDefault, nil, device, nil, &textureCache)

        setupRenderPipeline()
    }

    func render(pixelBuffer: CVPixelBuffer) {
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)

        // Y 平面纹理（零拷贝：直接映射 IOSurface）
        var texY: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(
            kCFAllocatorDefault, textureCache,
            pixelBuffer, nil, .r8Unorm, width, height, 0, &texY)

        // UV 平面纹理
        var texUV: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(
            kCFAllocatorDefault, textureCache,
            pixelBuffer, nil, .rg8Unorm, width / 2, height / 2, 1, &texUV)

        guard let mtlY = CVMetalTextureGetTexture(texY!),
              let mtlUV = CVMetalTextureGetTexture(texUV!) else { return }

        // 提交 GPU 绘制命令
        guard let drawable = metalLayer.nextDrawable(),
              let commandBuffer = commandQueue.makeCommandBuffer() else { return }

        let descriptor = MTLRenderPassDescriptor()
        descriptor.colorAttachments[0].texture = drawable.texture
        descriptor.colorAttachments[0].loadAction = .clear

        let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor)!
        encoder.setRenderPipelineState(pipelineState)
        encoder.setFragmentTexture(mtlY, index: 0)
        encoder.setFragmentTexture(mtlUV, index: 1)
        encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
        encoder.endEncoding()

        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

**YUV→RGB Shader：**

```c
#include <metal_stdlib>
using namespace metal;

struct VertexOut {
    float4 position [[position]];
    float2 texCoord;
};

fragment float4 fragmentShader(VertexOut in [[stage_in]],
                               texture2d<float> texY [[texture(0)]],
                               texture2d<float> texUV [[texture(1)]]) {
    constexpr sampler s(address::clamp_to_edge, filter::linear);

    float y = texY.sample(s, in.texCoord).r;
    float2 uv = texUV.sample(s, in.texCoord).rg;

    // BT.709 色彩空间转换
    float y_adj = y - 0.0625;
    float u = uv.x - 0.5;
    float v = uv.y - 0.5;

    float r = y_adj + 1.5748 * v;
    float g = y_adj - 0.1873 * u - 0.4681 * v;
    float b = y_adj + 1.8556 * u;

    return float4(r, g, b, 1.0);
}
```

### 4.5 音频同步

音频路径默认使用 PCM 编码（低延迟，无需解压缩），同时支持 AAC 作为降级方案：

```cpp
class AudioDecoder {
public:
    int write(const uint8_t* data, size_t size, int64_t pts);
    int readPCM(uint8_t* buffer, size_t size, int64_t* pts);

private:
    PCMDecoder pcmDecoder_;   // PCM 直通（默认）
    AACDecoder aacDecoder_;   // FFmpeg AAC → PCM（降级）
};
```

Source 端默认发送 PCM 数据（采样率 48000Hz，双声道，16bit），接收端直接透传给 AudioQueue。当对端不支持 PCM 时，降级使用 AAC 编码——通过 FFmpeg 的 `avcodec_decode_audio4` 解码后转为 PCM 播放。

**AudioQueue 环形缓冲：** 使用 5 个缓冲区的环形结构，AudioQueue 系统回调请求数据时从 ring buffer 填充：

```cpp
class AudioPlayer {
    static constexpr int kBufferCount = 5;

    AudioQueueRef queue_{nullptr};
    AudioQueueBufferRef buffers_[kBufferCount];

    static void onBufferRequest(void* userData, AudioQueueRef queue,
                                 AudioQueueBufferRef buffer) {
        auto* player = static_cast<AudioPlayer*>(userData);
        player->fillBuffer(buffer);
    }

    void fillBuffer(AudioQueueBufferRef buffer) {
        size_t available = ringBuffer_.readableSize();
        size_t toRead = std::min(available, buffer->mAudioDataBytesCapacity);
        ringBuffer_.read(buffer->mAudioData, toRead);
        buffer->mAudioDataByteSize = toRead;
        AudioQueueEnqueueBuffer(queue_, buffer, 0, nullptr);
    }
};
```

**音画同步：** 音频时钟作为主时钟，视频帧渲染跟随音频播放进度。

---

## 五、反向控制的实现

反向控制让用户在 Mac/iPhone 上通过鼠标或触摸屏直接操控手机，是独立于视频流的通道。

### 5.1 架构

```
    Sink 端（Mac/iPhone）              网络                Source 端（手机）
┌───────────────────────┐    ┌──────────────┐    ┌─────────────────────┐
│ 鼠标/触摸事件采集      │    │              │    │ 指令解析             │
│       ↓               │    │  独立 UDP    │    │    ↓                │
│ 坐标归一化            │ ──►│  通道        │──► │ 坐标映射             │
│       ↓               │    │  (HID 指令)  │    │    ↓                │
│ 30Hz 节流 → 序列化    │    │              │    │ Android 输入系统注入  │
└───────────────────────┘    └──────────────┘    └─────────────────────┘
```

### 5.2 事件采集与指令编码

```swift
struct ControlCommand {
    enum ActionType: UInt8 {
        case touchDown  = 0
        case touchMove  = 1
        case touchUp    = 2
        case scroll     = 5
        case keyPress   = 6
    }

    let action: ActionType
    let x: Float         // 归一化坐标 (0.0 - 1.0)
    let y: Float
    let pressure: Float
    let timestamp: UInt64
}
```

macOS 端事件采集：

```swift
extension MirrorPlayView {
    override func mouseDown(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        let cmd = ControlCommand(
            action: .touchDown,
            x: Float(location.x / bounds.width),
            y: Float(location.y / bounds.height),
            pressure: Float(event.pressure),
            timestamp: currentTimeMicros()
        )
        throttler.submit(cmd)
    }

    override func mouseDragged(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        throttler.submit(ControlCommand(
            action: .touchMove,
            x: Float(location.x / bounds.width),
            y: Float(location.y / bounds.height),
            pressure: Float(event.pressure),
            timestamp: currentTimeMicros()
        ))
    }
}
```

### 5.3 指令发送

控制指令使用独立 UDP 通道，与视频流分离：

```cpp
class ControlChannel {
    UDPSocket socket_;

    int send(const ControlCommand& cmd) {
        uint8_t buffer[64];
        size_t offset = 0;
        buffer[offset++] = static_cast<uint8_t>(cmd.action);
        memcpy(buffer + offset, &cmd.x, 4);         offset += 4;
        memcpy(buffer + offset, &cmd.y, 4);         offset += 4;
        memcpy(buffer + offset, &cmd.pressure, 4);  offset += 4;
        memcpy(buffer + offset, &cmd.timestamp, 8); offset += 8;
        return socket_.send(buffer, offset);
    }
};
```

### 5.4 手机端响应

```cpp
void onCommandReceived(const uint8_t* data, size_t size) {
    auto cmd = deserialize(data, size);

    // 归一化坐标 → 手机实际像素坐标
    int screenX = static_cast<int>(cmd.x * deviceWidth_);
    int screenY = static_cast<int>(cmd.y * deviceHeight_);

    switch (cmd.action) {
    case TOUCH_DOWN: injectTouchEvent(ACTION_DOWN, screenX, screenY); break;
    case TOUCH_MOVE: injectTouchEvent(ACTION_MOVE, screenX, screenY); break;
    case TOUCH_UP:   injectTouchEvent(ACTION_UP, screenX, screenY);   break;
    }
}
```

### 5.5 延迟敏感性

| 类型     | 容忍延迟  | 影响             |
| -------- | --------- | ---------------- |
| 视频帧   | 100-300ms | 观感变差但可接受 |
| 控制指令 | < 50ms    | 用户感知"不跟手" |
| 连续滑动 | < 33ms    | 轨迹断裂感       |

控制通道的设计原则：独立 UDP 通道、指令优先级高于视频帧、数据极小（单包可达）。

---

## 六、踩坑记录

### Metal 渲染花屏（Intel Mac）

**现象：** Intel Mac 上随机花屏/绿屏，M 芯片机型完全正常。花屏不确定复现节奏，排查困难。

**排查过程：** 起初怀疑 FFmpeg 解码输出异常——为此绕过 FFmpeg 直接调 `VTDecompressionSession` 解码做对比，花屏依旧。又把解码后的视频帧写入本地文件播放，画面完全正常——彻底排除了解码层的嫌疑。进而拿同一解码输出换用 `AVSampleBufferDisplayLayer` 渲染，花屏消失——确认问题在 Metal 渲染层。最终定位到旧实现每帧都重新创建 `CVMetalTextureCache` 并在渲染后立即销毁。

`CVMetalTextureCache` 的正确用法是创建一次、持续复用（Apple 文档明确建议）。每帧重建虽然违反了最佳实践，但只有在 Intel GPU 的独立显存架构上才触发 GPU 资源竞态（GPU 还在引用纹理时 CPU 侧已释放）。M 芯片的统一内存架构对此容忍度更高，掩盖了问题。

修复本身不复杂：将 `TextureCache` 持久化到视图生命周期，加上 in-flight 帧数控制防止 GPU 积压。但教训值得记录——**在 M 芯片 Mac 上能正常运行 ≠ 在 Intel Mac 上也能正常运行**，充分覆盖两种架构的测试是必须的。

### 反控触摸采样率节流

**现象：** Mac 端拖拽操作时，手机端出现明显的操作延迟和卡顿，与视频流畅度无关。

**分析：**

各设备的触摸/手势采样率：

| 设备              | 触摸采样率 | 说明                           |
| ----------------- | ---------- | ------------------------------ |
| Mac 触控板 / 鼠标 | ~60-80 Hz  | macOS 按显示刷新率节奏交付事件 |
| iPhone（标准）    | ~60-120 Hz |                                |
| iPhone Pro        | ~120 Hz    | ProMotion 设备                 |
| iPad Pro          | **240 Hz** | 配合 Apple Pencil 低延迟       |

Mac 触控板以 ~70Hz 产生 `mouseDragged` 事件。如果全量转发到手机端，Android 的 `InputDispatcher` 按 vsync（60Hz）节奏消费事件，多余事件会排队等待下一个 vsync，累积延迟逐帧增长。

**解决方案：** 在 Sink 端对触控事件做 **30Hz 节流**：

```swift
class EventThrottler {
    private let interval: TimeInterval = 1.0 / 30.0  // 33ms
    private var lastSendTime: TimeInterval = 0
    private var pendingCommand: ControlCommand?

    func submit(_ command: ControlCommand) {
        let now = CACurrentMediaTime()

        // touchDown / touchUp 立即发送，不节流
        if command.action == .touchDown || command.action == .touchUp {
            send(command)
            lastSendTime = now
            return
        }

        // touchMove 做节流
        if now - lastSendTime >= interval {
            send(command)
            lastSendTime = now
        } else {
            pendingCommand = command  // 保留最新位置，下次发送
        }
    }
}
```

**为什么是 30Hz：**

- 30Hz 意味着每两个 vsync 周期（16.6ms × 2 = 33ms）最多一个事件到达，不会堆积
- 人眼对触控轨迹连续性的感知阈值约 20-30Hz，30Hz 的拖拽轨迹仍然平滑
- `touchDown` 和 `touchUp` 不节流，保证点击响应的即时性

### 其他典型问题

**分辨率动态变化导致硬解闪退：** 手机横竖屏切换时，码流的宽高突变。VideoToolbox 的 `VTDecompressionSession` 不支持动态分辨率变更——必须检测到 SPS 中的宽高变化后，销毁旧 Session 并以新参数重建。未处理时表现为 `kVTInvalidSessionErr` 后直接崩溃。

**音频缓冲区溢出：** AAC 解码后的 PCM 数据大小取决于采样率转换比例（如 44100→48000），不能硬编码固定值。修复：根据输入采样率和输出采样率动态计算缓冲区大小，同时统一由 AudioPlayer 管理 PCM buffer 生命周期，避免 double-free。

**PTS 重复导致帧乱序：** 编码端偶尔产生相同 PTS 的帧（B 帧参考或编码器 bug），渲染队列的 PTS 排序逻辑因此失效。修复：引入递增的 `frameIndex` 作为次级排序键——相同 PTS 时按到达顺序渲染，保证确定性。

---

## 七、与业界方案对比

| 维度        | 本方案                                | Scrcpy                  | AirPlay           | Google Cast        |
| ----------- | ------------------------------------- | ----------------------- | ----------------- | ------------------ |
| 传输协议    | RTSP/RTP + 自研 MPT（UDP/TCP/多链路） | ADB Tunnel（USB/Wi-Fi） | RTSP/RTP + UDP    | WebRTC             |
| 加密        | AES                                   | 无                      | FairPlay DRM      | DTLS-SRTP          |
| 视频解码    | VideoToolbox 硬解                     | FFmpeg 软解             | VideoToolbox 硬解 | 硬解               |
| 音频编码    | PCM / AAC                             | PCM / Opus              | ALAC / AAC        | Opus               |
| 反向控制    | 独立 UDP + HID 指令                   | ADB HID 事件注入        | MFI 协议          | WebRTC DataChannel |
| 延迟        | 30-100ms（局域网）                    | 30-70ms（有线）         | 50-200ms          | 50-300ms+          |
| 跨平台 Sink | macOS + iOS                           | 全桌面平台              | Apple 生态        | 全平台             |
| 开源        | 自研                                  | ✅ 开源                 | 部分开源          | 部分开源           |

各方案适用场景：

- **Scrcpy**：开发者调试 Android 应用的首选工具，延迟极低但依赖 ADB，无加密，不适合日常非开发场景
- **AirPlay**：Apple 生态内最优，端到端延迟低且集成好，但封闭生态限制了 Android → iPhone 方向
- **Google Cast**：跨平台能力最强（WebRTC），适合互联网跨网络投屏，但延迟较高（强依赖云端信令）
- **本方案**：取各家之长——传输层自研协议接近 AirPlay 的延迟水平，控制通道借鉴 Scrcpy 的反控思路，Sink 端覆盖 macOS/iOS 两大 Apple 平台

---

## 八、总结

本文分析了 Android 手机投屏到 Mac/iPhone 的端到端架构：

1. **Source 端**：Android 平台层（采集 + MediaCodec 编码）+ 投屏传输 SDK（加密 + RTP + 发送）

2. **Sink 端三层**：投屏传输 SDK（接收/解密）→ 编解码引擎（VideoToolbox 硬解 + 帧调度）→ UI 渲染层（Metal）。SDK 和引擎层 C++ 跨平台，渲染层平台各自实现

3. **网络传输**：基于 RTSP + RTP，自研 MPT 传输模块支持 UDP/TCP/天琴多链路

4. **反向控制**：独立 UDP 通道 + 30Hz 节流 + 坐标归一化映射

5. **跨架构兼容**：M 芯片的统一内存会掩盖 GPU 资源生命周期问题，需在 Intel Mac 上充分覆盖测试
