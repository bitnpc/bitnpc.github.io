---
title: 'Architecture Implementation of Android Screen Mirroring to Mac/iPhone'
pubDate: 2025-10-13
categories: [Audio/Video]
tags:
  - Screen Mirroring
  - Metal
  - Android

toc: true
description: 'End-to-end architecture of Android screen mirroring to Mac/iPhone: phone-side capture and hardware encoding, network transmission, receiver-side decoding, and Metal rendering. Covers reverse control, transport protocol, and latency optimization.'
---

## Introduction

Screen mirroring is a common need: projecting an Android phone screen in real time to a computer (Mac) or tablet (iPad/iPhone) for presentations, remote assistance, or multimedia sharing. Implementing a low-latency, high-smoothness mirroring solution requires covering the entire pipeline from screen capture and encoding on the phone side, through network transmission, to decoding and rendering on the receiving side.

This article uses Xiaomi's Smart Desktop screen mirroring solution as an example, analyzing two core capabilities from an architectural perspective: **Screen Mirroring** and **Reverse Control**.

## 1. Overall Architecture

### End-to-End Data Flow

```
┌─ Source Side (Phone) ──────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ Platform Layer (Android) ──────────────────────────────────────────┐    │
│  │  Screen Capture (MediaProjection)                                   │    │
│  │       ↓                                                             │    │
│  │  Hardware Encoder (MediaCodec)                                      │    │
│  │  H.264/H.265 │ 1080p@60fps │ 8Mbps │ IDR Response                  │    │
│  │       ↓                                                             │    │
│  │  Encoded Frame Callback → NAL Fragmentation                         │    │
│  └───────┬────────────────────────────────────────────────────────────┘    │
│          ▼                                                                  │
│  ┌─ Mirroring Transport SDK (Source Mode) ─────────────────────────────┐    │
│  │  AES Encryption → RTP Packetization (Seq# + Timestamp) → UDP/TCP Send  │    │
│  │  ← Receive Sink Feedback: Packet Loss / IDR Request / Bitrate Adjustment │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │ Wi-Fi LAN
                                   ▼
┌─ Sink Side (Mac / iPhone / Pad) ───────────────────────────────────────────┐
│  ┌─ Mirroring Transport SDK (Sink Mode) ────────────────────────────────┐  │
│  │  UDP/TCP Receive → RTP Reassembly → AES Decrypt → Dispatch by Media Type│
│  │  → Send Feedback to Source: Loss Stats / IDR Request / Suggested Bitrate │
│  └────────────────────────────────┬────────────────┬────────────────────┘  │
│                                   │ Video Callback  │ Audio Callback        │
│                                   ▼                ▼                        │
│  ┌─ Platform Layer (Mac/iPhone respective) ──────────────────────────────┐  │
│  │  VideoDecoder (VideoToolbox) → RenderManager → Metal Rendering       │  │
│  │  AudioDecoder (PCM/AAC) → AudioQueue Playback                        │  │
│  │  Reverse Control: Event Capture → 30Hz Throttle → Command Encode → UDP → Phone Injection│
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

The data flow consists of two channels: a **media channel** (phone → receiver, video/audio) and a **control channel** (receiver → phone, touch commands). The mirroring transport SDK runs symmetrically on both ends — the Source side handles encryption, packetization, and sending, while the Sink side handles receiving, decryption, and callback of raw audio/video data to the platform layer. The same SDK supports multiple mirroring combinations: "phone → Mac," "phone → iPhone," "phone → Pad," and more.

### Mirroring Transport SDK

The foundation of the entire mirroring system is a **cross-platform mirroring transport SDK** (C++ implementation, shared across Android / macOS / iOS / Windows). This SDK runs on both the Source and Sink sides, encapsulating connection establishment, protocol parsing, encryption/decryption, and media data transmission. It exposes codec callbacks to the upper layer through a plugin mechanism. The transport layer is based on **RTSP + RTP**, with a custom MPT transport module supporting UDP/TCP fallback and multi-link switching. Section 3 will elaborate on its design.

---

## 2. Source Side: Phone Encoding and Sending

```
┌─────────────────────────────────────────────────────────────┐
│  Android Platform Layer                                      │
│                                                             │
│  MediaProjection (Screen Capture)                           │
│       ↓ Surface                                             │
│  MediaCodec (Hardware Encoder)                              │
│       │  H.264/H.265  │  Config: Resolution/FPS/Bitrate/Profile │
│       ↓ Encoded Frame Callback                              │
│  NAL Fragmentation Processing                               │
│       ↓                                                     │
├─────────────────────────────────────────────────────────────┤
│  Mirroring Transport SDK                                     │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────────┐  │
│  │ AES Encrypt│ → │ RTP Packet│ → │ UDP/TCP Send          │  │
│  └──────────┘    └──────────┘    └───────────────────────┘  │
│       ↑                                                     │
│  Bitrate Adjustment / IDR Request (from Sink feedback)      │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Encoding Parameter Selection

```cpp
struct EncoderConfig {
    CodecType codec = CodecType::H265;  // Default H.265, fallback to H.264 on older devices
    int width = 1920;
    int height = 1080;
    int fps = 60;
    int bitrate = 8 * 1000 * 1000;  // 8 Mbps
    int profile;
    int level;
};
```

**H.264 vs H.265:**

| Comparison              | H.264              | H.265           |
| ----------------------- | ------------------ | --------------- |
| Hardware Compatibility  | Nearly all devices | Newer devices   |
| Bitrate at Same Quality | Baseline           | ~30-50% lower   |
| Encoding Latency        | Lower              | Slightly higher |
| Decoding Complexity     | Low                | High            |

Strategy: Use H.265 by default for lower bitrate (approximately 30-50% reduction at the same quality), and force fallback to H.264 only on older devices such as iPad mini 4 and iPad Air 2 to ensure compatibility. Resolution and frame rate are dynamically adjusted based on network conditions — 1080p@60fps when the network is good, and degradation to 720p@30fps during network fluctuations.

### 2.2 Data Packetization and Send Pipeline

The compressed frames output by the encoder go through the following pipeline to reach the network:

```
Encoder Output NAL Units
       ↓
  NAL Fragmentation and Encapsulation
       ↓
  RTP Packetization (Sequence# + Timestamp)
       ↓
    AES Encryption
       ↓
  ┌────┴────┐
  │ Network │
  └────┬────┘
 Normal ↙     ↘ Severe Packet Loss
UDP Send     TCP Send
```

**NAL Fragmentation:** A single H.264 frame may exceed the UDP MTU (1500 bytes) and requires fragmentation. The receiver reassembles the complete frame based on RTP sequence numbers.

**RTP Protocol:** Sequence numbers are used to detect packet loss and reorder packets; timestamps carry the frame's capture time, which the receiver uses to compute presentation timestamps and jitter buffer.

**AES Encryption:** All video payloads are encrypted to ensure mirroring content cannot be eavesdropped on within the LAN.

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

### 2.3 Encoder Event Callbacks

- **IDR Request:** When the receiver detects packet loss or decoding anomalies, it requests the phone to send a keyframe to restore the picture.
- **Bitrate Change Notification:** When network bandwidth changes, the encoder is notified to adjust the target bitrate.
- **Encoding Exception:** Handling of hardware failures or insufficient resources.

---

## 3. Mirroring Transport SDK

The lowest layer of the mirroring system is a cross-platform C++ SDK that runs on both Android (Source) and macOS/iOS (Sink). The SDK encapsulates protocol parsing, network transport, encryption/decryption, and session management, exposing a unified plugin interface and option configuration to the upper layer.

### 3.1 Dual-End Roles and Plugin Mechanism

The SDK adopts a Server-Client model, with symmetric interfaces but different responsibilities on each end:

```
┌─ Source Side ────────────────────────────┐  ┌─ Sink Side ──────────────────────────────┐
│                                           │  │                                           │
│  IMiPlayCastMirrorServer (C++ Interface)  │  │  IMiPlayCastMirrorClient (C++ Interface) │
│                                           │  │                                           │
│  • attachSurface(surface)  Bind capture Surface│  • attachSurface(surface)  Bind render Surface│
│  • setAttribute(type, val) Set encoding params│  • setAttribute(type, val) Set decoding params│
│  • registerVideoPlugin(p)  Register encode CB│  • registerVideoPlugin(p)  Register decode CB│
│  • registerAudioPlugin(p)  Register audio CB  │  • registerAudioPlugin(p)  Register audio CB  │
│  • registerStateCallback() Register state CB  │  • registerStateCallback() Register state CB  │
│  • write(type, data, len, pts) Send encoded frame│  • start(uri) / stop()  Control session       │
│  • start(uri) / stop()  Control session      │  • pause(mediaType) / resume()  Media control  │
│                                           │  │                                           │
└───────────────────────────────────────────┘  └───────────────────────────────────────────┘
```

The SDK decouples from the upper layer's decoding/rendering logic through a **plugin interface**. The upper layer only needs to implement the `MediaPlugin` interface and register it:

```cpp
class MediaPlugin {
public:
    virtual int32_t onInit(MediaAttribute attr) = 0;  // Receive negotiated media parameters
    virtual int32_t onStart() = 0;
    virtual int32_t onStop() = 0;
    virtual int32_t onPause() = 0;
    virtual int32_t onResume() = 0;
    virtual int32_t onChangeMediaAttribute(int32_t type, MediaAttribute attr) = 0;
};
```

Encoding/decoding parameters are preset via `setAttribute()`. After connection establishment, the SDK negotiates with the peer. The negotiation result is delivered to the plugin via the `MediaAttribute` struct in the `onInit()` callback:

```cpp
struct MediaAttribute {
    int32_t width;        // Video width
    int32_t height;       // Video height
    int32_t fps;          // Frame rate
    int8_t  format[50];   // Codec format string (video/avc, etc.)
    int32_t profile;      // Profile
    int32_t level;        // Level
    int32_t bitrate;      // Bitrate (bps)
    int32_t channels;     // Audio channel count
    int32_t sampleBits;   // Audio sample bit depth
    int32_t sampleRate;   // Audio sample rate
};
```

### 3.2 State Callback and Session Lifecycle

The SDK reports connection status and data arrival through the `StateCallback` interface:

```cpp
class StateCallback {
public:
    virtual void onStarted(int32_t localPort) = 0;           // Server started successfully
    virtual void onConnected() = 0;                          // Connection established
    virtual void onDisconnected() = 0;                       // Connection disconnected
    virtual void onPlayed(int32_t status) = 0;               // Media playback started
    virtual void onError(int32_t what, int32_t extra) = 0;   // Error
    virtual void onInfo(int32_t what, int64_t extra) = 0;    // Info notification
    virtual int32_t onReceiveData(int32_t mediaType,         // Media data received
                                   int8_t* data, int32_t len, int64_t pts) = 0;
};
```

A complete mirroring session from connection to playback:

```
Server.start(uri)                                        Client.start(uri)
       │                                                       │
       ▼                                                       ▼
  Connection Established ─── TCP Handshake / RTSP Signaling ───→ Connection Established
       │                                                       │
       ▼                                                       ▼
onStarted(localPort)                                   onConnected()
       │                                                       │
       ▼                                                       ▼
  Encryption Negotiation ──── AES key/iv Exchange ───────────→ Encryption Negotiation
       │                                                       │
       ▼                                                       ▼
registerMediaPlugin()                                 registerMediaPlugin()
       │                                                       │
       ▼                                                       ▼
  Start Data Stream ──────── RTP over UDP ────────────────→ onReceiveData()
       │                                                     → plugin.onInit(attr)
       │                                                     → plugin.onStart()
       ▼                                                       ▼
onPlayed(0)                                           onPlayed(0)
```

### 3.3 Transport Protocol

The SDK is based on the **RTSP + RTP** protocol stack, with extensions built on top of the standard RTP layer:

```
Application Data Layer: Encoded H.264/H.265 video frames / PCM/AAC audio frames
     ↓
RTP Encapsulation Layer: Sequence# + Timestamp + Payload Type ID
     ↓
Custom Transport Layer (MPT): UDP preferred, with TCP fallback and Lyra Channel support
     ↓
Physical Link: Wi-Fi / P2P / Bluetooth
```

RTP sequence numbers are used for packet loss detection and out-of-order reordering; timestamps restore frames to their capture timeline — this is the foundation of the Jitter Buffer.

**Lyra Channel:** The SDK also supports transmission over the "Lyra" link — the phone and receiver can exchange RTP/RTSP data via Bluetooth, self-organizing WLAN, or remote relay channels without needing to be on the same LAN. `Option_UseLyraChannel` controls which underlying link is used. This mechanism further expands the usage scenarios for screen mirroring.

### 3.4 Parameter Negotiation and Adaptive Bitrate

Encoding parameters are not determined unilaterally by one end. Instead, after being preset via `setAttribute()`, the SDK negotiates with the peer during the connection establishment phase:

```
Source setAttribute()                        Sink setAttribute()
  VideoWidth  = 1920                          VideoWidth  = 1920
  VideoFps    = 60                            VideoFps    = 60
  VideoEncType = H265                         VideoEncType = H264  ← Sink prefers H.264
  VideoBitrate = 8M
       │                                        │
       └──────── Negotiation Result ─────────────┘
                     VideoEncType = H264  (intersection, Sink doesn't support H.265)
                     Other parameters take the minimum
                     → Delivered to upper layer via onInit(attr)
```

The SDK has built-in adaptive bitrate control (`Option_EnableAdptiveFun`). During runtime, it dynamically adjusts the encoding bitrate based on RTP packet loss feedback, without requiring the upper layer to intervene with core logic — the upper layer only needs to listen for adjustment events through `onInfo()`.

### 3.5 Encryption System

The SDK's encryption is layered:

| Layer                | Configuration                    | Description                                                |
| -------------------- | -------------------------------- | ---------------------------------------------------------- |
| Encryption Type      | `ENCRYPTION_TYPE_AES` / `SMS4`   | Select encryption algorithm                                |
| Encryption Level     | `AESCBC128` / `192` / `256`      | AES key length                                             |
| Encryption Scope     | `FORMAT_VIDEO` / `AUDIO` / `CMD` | Selectively encrypt only video, audio, or control commands |
| Transport Encryption | `ENCRYPTION_TRANSLEVEL_XOR`      | Additional XOR protection during key transmission          |
| Integrity            | `SHA256` / `SHA128` / `MD5`      | Data integrity verification                                |

Encryption keys (`key` + `iv`) and authentication keys (`authKey`) are injected by the upper layer via `setAttribute()` before `start()`. Encryption and decryption are handled transparently within the SDK — the upper layer receives plaintext audio/video data.

---

## 4. Sink Side: Receiving, Decoding, and Rendering

The Sink side is the most complex part of the entire system. Its internal architecture:

```
┌─ SDK Protocol Layer ───────────────────────────────────────┐
│  UDP/TCP Receive → AES Decrypt → RTP Reassembly → Media Type Dispatch │
└────────────────────────────┬─────────────┬────────────────┘
                             │ Video       │ Audio
┌─ Codec Engine Layer ──────▼─────────────▼────────────────┐
│                                                            │
│  VideoDecoder (VideoToolbox)   AudioDecoder (PCM/AAC)        │
│       ↓                          ↓                        │
│  RenderManager                AudioPlayer                 │
│  (Jitter Buffer/Frame Scheduler) (AudioQueue Ring Buffer) │
│       ↓                                                   │
├───────┼───────────────────────────────────────────────────┤
│       ↓              UI Rendering Layer                    │
│  MetalRenderView（YUV→RGB / Zero-Copy）                    │
└───────────────────────────────────────────────────────────┘
```

### 4.1 SDK Protocol Layer

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

The protocol layer dispatches data through a callback pattern: received video data calls `VideoPlugin::write()`, received audio data calls `AudioPlugin::write()`, and connection state changes are reported via `StateCallback`.

The SDK includes a first-level Jitter Buffer (configured with `JitterBufferSetEnable = 1`, buffer threshold `BufferingThreshold = 200ms`), which absorbs jitter at the network reception layer. Frames delivered to the engine layer via callback are already reordered by PTS. The engine layer's `RenderManager` serves as the second-level Jitter Buffer, controlling the rendering timing of decoded frames.

### 4.2 Video Decoding Engine

The video decoder is based on VideoToolbox hardware acceleration, with FFmpeg software decoding as a fallback:

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
        // Construct CMVideoFormatDescription from SPS/PPS
        CMVideoFormatDescriptionCreateFromH264ParameterSets(
            nullptr, paramCount, paramPointers, paramSizes, 4,
            &formatDescription_);

        // Create VTDecompressionSession
        VTDecompressionOutputCallbackRecord callback{&onFrameDecoded, this};
        return VTDecompressionSessionCreate(
            nullptr, formatDescription_, decoderSpec,
            destImageBufferAttributes, &callback, &session_);
    }

    int decode(const uint8_t* data, size_t size, int64_t pts) {
        // Annex-B startcode → AVCC length-prefix format conversion
        auto avccData = convertAnnexBToAVCC(data, size);

        // Construct CMSampleBuffer and submit for decoding
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

During decoder initialization, a `CMVideoFormatDescription` is constructed from the SPS/PPS in the bitstream, and a `VTDecompressionSession` is created. Received encoded data must undergo an **Annex-B → AVCC format conversion** (replacing `0x00000001` start codes with 4-byte length prefixes), encapsulated into a `CMSampleBuffer`, and then submitted to VideoToolbox for asynchronous decoding. The decoded `CVPixelBuffer` is pushed via callback into the `RenderManager` awaiting rendering scheduling.

The core code path of the decoding pipeline:

```
Decode Thread receiveLoop():
    ├─ put(AVPacket) → Enqueue to decode queue
    ├─ decodeLoop(): Dequeue packets
    │   └─ NativeVTDecoder.decode() → VTDecompressionSessionDecodeFrame()
    └─ onFrameDecoded() callback → RenderManager.addFrame()
```

The decoding thread runs independently and is decoupled from the rendering thread via a frame queue (see [Other Typical Issues](#other-typical-issues) for details).

### 4.3 Frame Scheduling and Render Management

The frame scheduler is the core component that balances **latency and smoothness**:

```cpp
class RenderManager {
public:
    void addFrame(int64_t index, int64_t pts);
    int64_t render();  // Returns wait time until next render (μs)
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
    int64_t recommendMinus_{0};        // Recommended render lead time
    int64_t vsyncInterval_{16000};     // V-Sync interval (μs, ~60fps)
    int64_t maxRenderDelayUs_{70000};  // Maximum tolerable render delay
    int maxRenderCache_{0};
};
```

**Core Scheduling Logic:**

```cpp
int64_t RenderManager::render() {
    if (pendingFrames_.empty()) return emptyWaitTime_;

    auto& frame = pendingFrames_.front();
    int64_t now = currentTimeMicros();
    int64_t targetTime = frame.pts + recommendMinus_;

    // Queue backlog: drop old frames, keep only the newest
    if (maxRenderCache_ > 0 && pendingFrames_.size() > maxRenderCache_) {
        while (pendingFrames_.size() > 1) {
            pendingFrames_.pop_front();
            dropCount_++;
        }
    }

    // Frame too old: drop
    if (now - targetTime > maxRenderDelayUs_) {
        pendingFrames_.pop_front();
        dropCount_++;
        return 0;  // Check next frame immediately
    }

    // Not yet time to render: wait
    if (now < targetTime) return targetTime - now;

    // Render
    pendingFrames_.pop_front();
    renderCallback_(frame.pts, now, false);
    return vsyncInterval_;
}
```

**Key Design Decisions:**

- **Frame Drop Strategy:** When the queue backs up, prefer dropping old frames and retaining new ones — screen mirroring displays "the current view" rather than "smooth playback."
- **Two-Level Jitter Buffer:** The SDK layer provides the first-level buffer (200ms threshold, absorbing network jitter and reordering out-of-sequence frames); the engine layer provides the second level of control (dynamically adjusting based on rendering progress). Increase the buffer (trade latency for smoothness) when jitter is high; decrease the buffer (reduce latency) when jitter is low.
- **V-Sync Alignment:** Render timing is aligned with the screen's refresh signal to reduce screen tearing.

### 4.4 Metal Hardware Rendering

After the decoder outputs a `CVPixelBuffer`, it needs to be displayed on screen. On Apple platforms, there are two options: using `AVSampleBufferDisplayLayer` directly (system-managed rendering) or using Metal for custom rendering control.

| Dimension       | Metal Custom Rendering                | AVSampleBufferDisplayLayer                             |
| --------------- | ------------------------------------- | ------------------------------------------------------ |
| Render Timing   | Fully controlled (in sync with VSync) | Internal system buffer queue, latency not controllable |
| Drop Strategy   | Custom (drop old, keep new)           | System decides, cannot intervene                       |
| Color Space     | Custom YUV→RGB shader                 | System handles automatically                           |
| Code Complexity | High                                  | Low (a few lines of enqueue code)                      |

Screen mirroring is a latency-sensitive scenario where the core requirement is to **decide for yourself "when to render which frame."** When network jitter causes frame accumulation, we need to drop old frames and show only the latest picture — this is not achievable with `AVSampleBufferDisplayLayer` (which plays frames smoothly in PTS order, suitable for video players, not for real-time mirroring). Therefore, Metal custom rendering is the chosen approach.

The Metal render view achieves zero-copy on-screen display through `CVMetalTextureCache`:

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

        // CVMetalTextureCache: key to zero-copy
        CVMetalTextureCacheCreate(kCFAllocatorDefault, nil, device, nil, &textureCache)

        setupRenderPipeline()
    }

    func render(pixelBuffer: CVPixelBuffer) {
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)

        // Y plane texture (zero-copy: direct IOSurface mapping)
        var texY: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(
            kCFAllocatorDefault, textureCache,
            pixelBuffer, nil, .r8Unorm, width, height, 0, &texY)

        // UV plane texture
        var texUV: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(
            kCFAllocatorDefault, textureCache,
            pixelBuffer, nil, .rg8Unorm, width / 2, height / 2, 1, &texUV)

        guard let mtlY = CVMetalTextureGetTexture(texY!),
              let mtlUV = CVMetalTextureGetTexture(texUV!) else { return }

        // Submit GPU draw commands
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

**YUV→RGB Shader:**

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

    // BT.709 color space conversion
    float y_adj = y - 0.0625;
    float u = uv.x - 0.5;
    float v = uv.y - 0.5;

    float r = y_adj + 1.5748 * v;
    float g = y_adj - 0.1873 * u - 0.4681 * v;
    float b = y_adj + 1.8556 * u;

    return float4(r, g, b, 1.0);
}
```

### 4.5 Audio Synchronization

The audio path uses PCM encoding by default (low latency, no decompression required), with AAC supported as a fallback:

```cpp
class AudioDecoder {
public:
    int write(const uint8_t* data, size_t size, int64_t pts);
    int readPCM(uint8_t* buffer, size_t size, int64_t* pts);

private:
    PCMDecoder pcmDecoder_;   // PCM passthrough (default)
    AACDecoder aacDecoder_;   // FFmpeg AAC → PCM (fallback)
};
```

The Source side sends PCM data by default (sample rate 48000Hz, stereo, 16bit), which the receiver passes directly to AudioQueue. When the peer does not support PCM, it falls back to AAC encoding — decoded via FFmpeg's `avcodec_decode_audio4` and converted to PCM for playback.

**AudioQueue Ring Buffer:** Uses a ring structure with 5 buffers. When the AudioQueue system callback requests data, it fills from the ring buffer:

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

**Audio-Video Synchronization:** The audio clock serves as the master clock; video frame rendering follows the audio playback progress.

---

## 5. Reverse Control Implementation

Reverse control allows the user to directly manipulate the phone from a Mac/iPhone using a mouse or touchscreen. It operates as a channel independent from the video stream.

### 5.1 Architecture

```
    Sink Side (Mac/iPhone)               Network                Source Side (Phone)
┌───────────────────────┐    ┌──────────────┐    ┌─────────────────────┐
│ Mouse/Touch Event Capture │    │              │    │ Command Parsing      │
│       ↓               │    │  Independent │    │    ↓                │
│ Coordinate Normalize  │ ──►│  UDP Channel │──► │ Coordinate Mapping  │
│       ↓               │    │  (HID Cmds)  │    │    ↓                │
│ 30Hz Throttle → Serialize│    │              │    │ Android Input Injection│
└───────────────────────┘    └──────────────┘    └─────────────────────┘
```

### 5.2 Event Capture and Command Encoding

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
    let x: Float         // Normalized coordinate (0.0 - 1.0)
    let y: Float
    let pressure: Float
    let timestamp: UInt64
}
```

macOS event capture:

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

### 5.3 Command Sending

Control commands use a dedicated UDP channel, separate from the video stream:

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

### 5.4 Phone-Side Response

```cpp
void onCommandReceived(const uint8_t* data, size_t size) {
    auto cmd = deserialize(data, size);

    // Normalized coordinates → actual phone pixel coordinates
    int screenX = static_cast<int>(cmd.x * deviceWidth_);
    int screenY = static_cast<int>(cmd.y * deviceHeight_);

    switch (cmd.action) {
    case TOUCH_DOWN: injectTouchEvent(ACTION_DOWN, screenX, screenY); break;
    case TOUCH_MOVE: injectTouchEvent(ACTION_MOVE, screenX, screenY); break;
    case TOUCH_UP:   injectTouchEvent(ACTION_UP, screenX, screenY);   break;
    }
}
```

### 5.5 Latency Sensitivity

| Type                 | Tolerable Latency | Impact                                 |
| -------------------- | ----------------- | -------------------------------------- |
| Video Frames         | 100-300ms         | Perceptible degradation but acceptable |
| Control Commands     | < 50ms            | User perceives "unresponsive"          |
| Continuous Scrolling | < 33ms            | Trajectory feels disjointed            |

Design principles for the control channel: dedicated UDP channel, commands prioritized over video frames, minimal data size (single packet reachable).

---

## 6. Pitfall Log

### Metal Rendering Artifacts (Intel Mac)

**Symptoms:** Random artifacts/green screen on Intel Macs, completely normal on M-series chips. The artifacts were not consistently reproducible, making them difficult to diagnose.

**Investigation Process:** Initially suspected FFmpeg decoding output anomalies — bypassed FFmpeg and directly called `VTDecompressionSession` for decoding as a comparison, but the artifacts persisted. Then wrote the decoded video frames to a local file and played them back — the picture was perfectly normal, completely ruling out the decoding layer. Further testing with the same decoded output but using `AVSampleBufferDisplayLayer` for rendering eliminated the artifacts — confirming the issue was in the Metal rendering layer. Ultimately traced the root cause to the old implementation recreating `CVMetalTextureCache` every frame and destroying it immediately after rendering.

The correct usage of `CVMetalTextureCache` is to create it once and reuse it continuously (Apple documentation explicitly recommends this). Although recreating it every frame violates best practices, it only triggers a GPU resource race condition on Intel GPUs with discrete video memory architecture (the GPU is still referencing the texture when the CPU side has already released it). The M-series chips' unified memory architecture is more tolerant of this, masking the problem.

The fix itself is not complex: persist the `TextureCache` for the view's lifetime and add in-flight frame count control to prevent GPU backpressure. However, the lesson is worth recording — **running correctly on an M-series Mac does not mean it will run correctly on an Intel Mac**; thorough testing covering both architectures is essential.

### Reverse Control Touch Sample Rate Throttling

**Symptoms:** When dragging on the Mac side, the phone side exhibited noticeable operation latency and lag, unrelated to video smoothness.

**Analysis:**

Touch/gesture sample rates for various devices:

| Device               | Touch Sample Rate | Notes                                         |
| -------------------- | ----------------- | --------------------------------------------- |
| Mac Trackpad / Mouse | ~60-80 Hz         | macOS delivers events at display refresh rate |
| iPhone (standard)    | ~60-120 Hz        |                                               |
| iPhone Pro           | ~120 Hz           | ProMotion devices                             |
| iPad Pro             | **240 Hz**        | Low latency with Apple Pencil                 |

The Mac trackpad generates `mouseDragged` events at approximately 70Hz. If forwarded to the phone at full rate, Android's `InputDispatcher` consumes events at vsync (60Hz) rate, causing excess events to queue up for the next vsync — cumulative latency grows frame by frame.

**Solution:** Apply **30Hz throttling** to touch events on the Sink side:

```swift
class EventThrottler {
    private let interval: TimeInterval = 1.0 / 30.0  // 33ms
    private var lastSendTime: TimeInterval = 0
    private var pendingCommand: ControlCommand?

    func submit(_ command: ControlCommand) {
        let now = CACurrentMediaTime()

        // touchDown / touchUp send immediately, no throttling
        if command.action == .touchDown || command.action == .touchUp {
            send(command)
            lastSendTime = now
            return
        }

        // touchMove is throttled
        if now - lastSendTime >= interval {
            send(command)
            lastSendTime = now
        } else {
            pendingCommand = command  // Keep latest position, send next time
        }
    }
}
```

**Why 30Hz:**

- 30Hz means at most one event arrives every two vsync cycles (16.6ms × 2 = 33ms), preventing accumulation.
- The human visual perception threshold for touch trajectory continuity is approximately 20-30Hz; drag trajectories at 30Hz are still smooth.
- `touchDown` and `touchUp` are not throttled, ensuring immediate click responsiveness.

### Other Typical Issues

<a name="other-typical-issues"></a>

**Hardware Decoder Crash on Resolution Change:** When the phone rotates between portrait and landscape, the video dimensions change abruptly. VideoToolbox's `VTDecompressionSession` does not support dynamic resolution changes — the old session must be destroyed and a new one created with the new parameters upon detecting width/height changes in SPS. When not handled, this manifests as `kVTInvalidSessionErr` followed by a crash.

**Audio Buffer Overflow:** The PCM data size after AAC decoding depends on the sample rate conversion ratio (e.g., 44100→48000) and cannot be hardcoded to a fixed value. Fix: dynamically calculate the buffer size based on input and output sample rates, and unify PCM buffer lifecycle management under AudioPlayer to avoid double-free.

**Duplicate PTS Causing Frame Reordering Issues:** The encoder occasionally produces frames with identical PTS values (due to B-frame references or encoder bugs), breaking the rendering queue's PTS sorting logic. Fix: introduce an incrementing `frameIndex` as a secondary sort key — when PTS values are identical, render in arrival order for deterministic behavior.

---

## 7. Comparison with Industry Solutions

| Dimension           | This Solution                              | Scrcpy                  | AirPlay                | Google Cast           |
| ------------------- | ------------------------------------------ | ----------------------- | ---------------------- | --------------------- |
| Transport Protocol  | RTSP/RTP + Custom MPT (UDP/TCP/Multi-link) | ADB Tunnel (USB/Wi-Fi)  | RTSP/RTP + UDP         | WebRTC                |
| Encryption          | AES                                        | None                    | FairPlay DRM           | DTLS-SRTP             |
| Video Decoding      | VideoToolbox HW Decode                     | FFmpeg SW Decode        | VideoToolbox HW Decode | HW Decode             |
| Audio Encoding      | PCM / AAC                                  | PCM / Opus              | ALAC / AAC             | Opus                  |
| Reverse Control     | Independent UDP + HID Commands             | ADB HID Event Injection | MFI Protocol           | WebRTC DataChannel    |
| Latency             | 30-100ms (LAN)                             | 30-70ms (Wired)         | 50-200ms               | 50-300ms+             |
| Cross-Platform Sink | macOS + iOS                                | All Desktop Platforms   | Apple Ecosystem        | All Platforms         |
| Open Source         | Proprietary                                | Open Source             | Partially Open Source  | Partially Open Source |

Applicable scenarios for each solution:

- **Scrcpy:** The go-to tool for Android developers debugging their devices. Extremely low latency but requires ADB, no encryption, unsuitable for everyday non-development scenarios.
- **AirPlay:** The best choice within the Apple ecosystem — low end-to-end latency and great integration, but the closed ecosystem limits the Android → iPhone direction.
- **Google Cast:** Strongest cross-platform capability (WebRTC), suitable for Internet-based cross-network mirroring, but with higher latency (heavily reliant on cloud signaling).
- **This Solution:** Takes the best from each approach — the transport layer's custom protocol achieves latency close to AirPlay, the control channel borrows from Scrcpy's reverse control concept, and the Sink side covers both macOS and iOS Apple platforms.

---

## 8. Summary

This article analyzed the end-to-end architecture of Android phone screen mirroring to Mac/iPhone:

1. **Source Side:** Android platform layer (capture + MediaCodec encoding) + Mirroring transport SDK (encryption + RTP + sending).

2. **Sink Side Three Layers:** Mirroring transport SDK (receive/decrypt) → Codec engine (VideoToolbox HW decode + frame scheduling) → UI rendering layer (Metal). The SDK and engine layer are cross-platform C++, while the rendering layer is implemented per platform.

3. **Network Transport:** Based on RTSP + RTP, with a custom MPT transport module supporting UDP/TCP/Lyra multi-link.

4. **Reverse Control:** Independent UDP channel + 30Hz throttling + coordinate normalization mapping.

5. **Cross-Architecture Compatibility:** M-series chips' unified memory can mask GPU resource lifecycle issues; thorough testing must be covered on Intel Macs.
