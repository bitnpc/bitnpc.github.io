---
title: 'Mac Screen Casting to Android Pad Architecture'
pubDate: 2025-11-20
categories: [Audio/Video]
tags:
  - Screen Mirroring
  - VideoToolbox
  - HID

toc: true
description: 'Mac-to-Android Pad screen casting architecture: virtual display capture, VideoToolbox encoding, VBR strategy, and HID reverse control.'
---

## Introduction

Apple's Sidecar extends the Mac display to an iPad and enables touch control of the Mac on the iPad. But Sidecar is limited to the Apple ecosystem — can we achieve the same experience on an Android Pad?

Using a Xiaomi Pad as an example, this article analyzes the screen casting architecture with **Mac as the Source and Android Pad as the Sink**, following a design philosophy similar to Sidecar. Core challenges: how to capture the screen on the Mac seamlessly, how to choose encoding parameters to maintain smoothness within limited bandwidth, and how to precisely map touch input from the Pad back to the Mac.

## 1. Overall Architecture

```
┌─ Source (Mac)────────────────────────────────────────────────────────────┐
│                                                                           │
│  ┌─ Platform Layer ────────────────────────────────────────────────┐     │
│  │  Virtual Display (CGVirtualDisplay) → Screen Capture (CGDisplayStream)│
│  │       ↓ IOSurface → CVPixelBuffer → CMSampleBuffer              │     │
│  │  VideoToolbox Hardware Encoding (H.265/H.264)                    │     │
│  └────────────────────────────┬────────────────────────────────────┘     │
│                               ▼                                           │
│  ┌─ Casting Transport SDK (Server Mode) ────────────────────────────┐     │
│  │  RTSP + RTP → AES Encryption → MPT Transport → Send               │     │
│  │  ← Receive Pad feedback: packet loss / IDR request                 │     │
│  └──────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ Wi-Fi
                                   ▼
┌─ Sink (Android Pad)──────────────────────────────────────────────────────┐
│  ┌─ Casting Transport SDK (Client Mode) ─────────────────────────────┐    │
│  │  Receive → Decrypt → RTP Reassembly → Decode Callback              │    │
│  │  → Send feedback to Source: packet loss stats / IDR request         │    │
│  └────────────────────────────┬───────────────────────────────────────┘    │
│                               ▼                                             │
│  ┌─ Platform Layer (Android)───────────────────────────────────────────┐   │
│  │  Video Decode (Hardware) → Render → Display                         │   │
│  │  Reverse Control: Touch Capture → HID Encoding → Protobuf → Send    │   │
│  │  via Casting Transport SDK                                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

Unlike the [previous article on phone-to-Mac screen casting](/posts/android-screen-mirroring-architecture/), the Mac here is the Source — responsible for **screen capture** and **encoding and sending**.

### Casting Transport SDK

The underlying layer uses a cross-platform casting transport SDK (C++ implementation, shared across Android/macOS/iOS/Windows). The SDK employs a Server-Client model, with the Mac running in **Server mode**: register video/audio encoding plugins → `setAttribute` to configure encoding parameters → the plugin outputs encoded frames and calls `write()` to send. The Pad acts as the Client, receiving, decoding, and rendering. The SDK's core mechanisms were analyzed in detail in the previous article; this article focuses on the Mac-specific design. In the Pad Sidecar scenario, audio is played through the Mac's local speakers or headphones, so audio capture and transmission are not implemented.

---

## 2. Screen Capture: Virtual Display

The core challenge of Mac screen casting is: how to capture the screen independently without mirroring the main display? The answer is to create a virtual display using `CGVirtualDisplay` — the same approach Sidecar uses.

### 2.1 Why a Virtual Display is Needed

```
Physical Display (2560x1440)          Virtual Display (1920x1080)
┌─────────────────────┐        ┌──────────────────┐
│                     │        │                  │
│    Main Workspace   │        │  Pad Extended    │
│                     │        │  Desktop         │
└─────────────────────┘        └──────────────────┘
```

Directly capturing the main display has two drawbacks: resolution mismatch (the main display is 2K/4K, while the Pad only needs 1080p); and the user's window operations would interfere with the cast content. A virtual display creates an independent desktop space — the Mac recognizes it as an extended display, and the Pad only shows windows on this virtual display, with no interference between them.

### 2.2 Creating the Virtual Display

macOS 10.13+ provides the `CGVirtualDisplay` private framework:

```objc
CGVirtualDisplayDescriptor *descriptor = [[CGVirtualDisplayDescriptor alloc] init];
descriptor.name = @"Virtual Display";
descriptor.maxPixelsWide = 3840;
descriptor.maxPixelsHigh = 2160;
descriptor.productID = 0x1234;
descriptor.vendorID = 0x3456;
descriptor.serialNum = 0x0001;

// Physical size calculated by PPI
CGFloat pixelsPerMillimeter = 110.0 / 25.4;  // ~110 PPI
descriptor.sizeInMillimeters = CGSizeMake(
    ceil(scaledWidth / pixelsPerMillimeter),
    ceil(scaledHeight / pixelsPerMillimeter));

CGVirtualDisplaySettings *settings = [[CGVirtualDisplaySettings alloc] init];
settings.hiDPI = 1;
settings.modes = @[
    [[CGVirtualDisplayMode alloc] initWithWidth:scaledWidth
                                         height:scaledHeight
                                    refreshRate:60],
    // Fallback resolution
    [[CGVirtualDisplayMode alloc] initWithWidth:scaledWidth * 4 / 5
                                         height:scaledHeight * 4 / 5
                                    refreshRate:60],
];

CGVirtualDisplay *virtualDisplay = [[CGVirtualDisplay alloc] initWithDescriptor:descriptor];
BOOL success = [virtualDisplay applySettings:settings];
CGDirectDisplayID displayID = virtualDisplay.displayID;
```

Once created, a virtual display appears in System Settings, and users can drag windows onto the Pad's extended desktop.

```alert
type: info
description: `CGVirtualDisplay` is a private framework and is not suitable for App Store submission. Sidecar uses the lower-level SidecarCore framework + AirPlay transport, which is similar in principle but differs in implementation.
```

### 2.3 CGDisplayStream Capture

Use `CGDisplayStream` to capture frames from the virtual display, with output format `kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange` (NV12):

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
    streamQueue,  // serial queue
    ^(CGDisplayStreamFrameStatus status,
      uint64_t displayTime,
      IOSurfaceRef frameSurface,
      CGDisplayStreamUpdateRef updateRef) {

        if (status != kCGDisplayStreamFrameStatusFrameComplete || !frameSurface) {
            return;
        }

        // IOSurface → CVPixelBuffer → CMSampleBuffer (zero-copy)
        CVPixelBufferRef pixelBuffer = NULL;
        CVPixelBufferCreateWithIOSurface(kCFAllocatorDefault, frameSurface, NULL, &pixelBuffer);

        CMTime pts = CMTimeMake(CACurrentMediaTime() * 1000000, 1000000);
        CMSampleBufferRef sampleBuffer = NULL;
        CMSampleBufferCreateForImageBuffer(kCFAllocatorDefault, pixelBuffer,
            YES, NULL, NULL, formatDesc, &timingInfo, &sampleBuffer);

        // Callback to encoder
        callback(sampleBuffer);

        CFRelease(sampleBuffer);
        CVPixelBufferRelease(pixelBuffer);
    }];
```

The entire pipeline `IOSurface → CVPixelBuffer → CMSampleBuffer` is zero-copy — they all share the same GPU memory, and data is only first read when VideoToolbox encodes.

### 2.4 Mirror Mode Protection

The virtual display is automatically recognized as an extended display, but in some scenarios the system may automatically switch to mirror mode. Register `CGDisplayRegisterReconfigurationCallback` to listen for changes and force it back to extended mode when mirroring is detected:

```c
// File-level static variable to prevent re-entrant handling of mirror mode switches
static BOOL isHandlingDisplayChange = NO;

// Register reconfiguration callback
CGDisplayRegisterReconfigurationCallback(reconfigCallback, (void *)displayID);

static void reconfigCallback(CGDirectDisplayID display,
                             CGDisplayChangeSummaryFlags flags,
                             void *userInfo) {
    CGDirectDisplayID targetID = (CGDirectDisplayID)(uintptr_t)userInfo;
    if (display != targetID || isHandlingDisplayChange) return;

    if (CGDisplayIsInMirrorSet(display)) {
        isHandlingDisplayChange = YES;
        // Force disable mirror mode
        CGDisplayConfigRef configRef;
        CGBeginDisplayConfiguration(&configRef);
        CGConfigureDisplayMirrorOfDisplay(configRef, display, kCGNullDirectDisplay);
        CGCompleteDisplayConfiguration(configRef, kCGConfigurePermanently);
        isHandlingDisplayChange = NO;
    }
}
```

---

## 3. VideoToolbox Encoding Engine

### 3.1 Encoding Pipeline

```
CGDisplayStream captures CMSampleBuffer (NV12)
       ↓
VTVideoEncoder.encodeFrame()
       ↓
VTCompressionSessionEncodeFrame() → Encoded output CMSampleBuffer (H.264/H.265)
       ↓
processEncodedFrame():
  - Key frame: insert SPS/PPS/VPS parameter sets
  - AVCC format → Annex-B format (length prefix → startcode 0x00000001)
       ↓
frameCallback_() → MCServer.write() → Casting Transport SDK → Network
```

### 3.2 Single Session + Lazy Rebuild

The encoder uses a single `VTCompressionSession`, created during initialization and reused until destruction. When the GPU context becomes invalid after the Mac wakes from sleep, only one lazy rebuild is needed:

```cpp
class VTVideoEncoder {
    VTCompressionSessionRef session_{nullptr};

    void encodeFrame(CMSampleBufferRef sampleBuffer) {
        OSStatus status = VTCompressionSessionEncodeFrame(
            session_, pixelBuffer, pts, kCMTimeInvalid, nullptr, nullptr, &infoFlags);

        // Rebuild only after GPU reset, covering the only exceptional path
        if (status == kVTInvalidSessionErr || status == kVTCompressionSessionHardwareError) {
            destroySession(session_);
            createSession(session_);
            status = VTCompressionSessionEncodeFrame(
                session_, pixelBuffer, pts, kCMTimeInvalid, nullptr, nullptr, &infoFlags);
        }
        if (status != noErr) {
            // Drop frame + log, do not block the capture thread
        }
    }
};
```

In screen casting scenarios, encoding parameters are fixed (the virtual display resolution does not change after creation), so the chance of needing to rebuild the Session is extremely low. The "zero-switch" advantage of dual Sessions has no triggering scenario; a single Session with lazy rebuild is cleaner.

### 3.3 Encoding Parameter Selection

```cpp
void configureEncoderProperties(VTCompressionSessionRef session) {
    // 1. RealTime mode — prioritize encoding speed
    VTSessionSetProperty(session, kVTCompressionPropertyKey_RealTime, kCFBooleanTrue);

    // 2. Disable B-frame reordering — eliminate encoder internal buffering delay
    VTSessionSetProperty(session, kVTCompressionPropertyKey_AllowFrameReordering, kCFBooleanFalse);

    // 3. Limit encoder delay — keep at most 1 reference frame
    int32_t maxFrameDelay = 1;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxFrameDelayCount,
        CFNumberCreate(nullptr, kCFNumberSInt32Type, &maxFrameDelay));

    // 4. Keyframe interval — screen casting is mostly static, long GOP reduces keyframe overhead
    int32_t gopSize = 15000;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxKeyFrameInterval,
        CFNumberCreate(nullptr, kCFNumberSInt32Type, &gopSize));
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration,
        CFNumberCreate(nullptr, kCFNumberFloatType, (float[]){300.0f}));

    // 5. Encoding quality — 0.7, a trade-off between quality and encoding speed
    float quality = 0.7;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_Quality,
        CFNumberCreate(nullptr, kCFNumberFloat32Type, &quality));
}
```

### 3.4 VBR Bitrate Strategy

VBR (Variable Bitrate) is used, with base bitrate calculated dynamically based on resolution:

```cpp
// Table-driven — different resolutions use different bit/pixel coefficients
struct BitrateConfig {
    int maxPixels;
    double hevcFactor;  // H.265 has higher compression ratio, smaller coefficient
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

// Base bitrate = pixelCount × factor
int64_t baseBitrate = static_cast<int64_t>(pixelCount * factor);

// Dynamic range: 40% ~ 150% of base bitrate
int64_t minBitrate = baseBitrate * 0.4;
int64_t maxBitrate = baseBitrate * 1.5;

CFArrayRef range = CFArrayCreate(...);
VTSessionSetProperty(session, kVTCompressionPropertyKey_DataRateLimits, range);
```

For 1080p H.265: `1920 × 1080 × 2.0 = 4,147,200 bps ≈ 4 Mbps`, dynamic range 1.6 ~ 6.2 Mbps.

**Why VBR instead of CBR:**

| Aspect              | VBR                                        | CBR                                      |
| ------------------- | ------------------------------------------ | ---------------------------------------- |
| Static scenes       | Bitrate decreases, saves bandwidth         | Pads with invalid data, wastes bandwidth |
| Dynamic scenes      | Bitrate peaks, quality first               | Quality degrades noticeably              |
| Casting suitability | ✅ Best match (desktop is mostly static)   | Not recommended                          |
| Large GOP size      | Bitrate fluctuates but stays within limits | Stable but wastes resources              |

Screen casting content is dominated by static scenes (documents, desktop). VBR's bandwidth utilization far exceeds CBR. The upper and lower limits of `DataRateLimits` ensure the bitrate does not go out of control.

### 3.5 VFR Frame Rate

The encoder uses VFR (Variable Frame Rate) — `kCMTimeInvalid` as the frame duration, `ExpectedFrameRate = 0`:

```cpp
float frameRate = 0.0f;
VTSessionSetProperty(session, kVTCompressionPropertyKey_ExpectedFrameRate,
    CFNumberCreate(nullptr, kCFNumberFloat32Type, &frameRate));
```

VFR has clear advantages in desktop casting scenarios: when the image is static, the capture side may skip frames, and VFR allows the encoder to skip empty frames directly without generating extra P-frames or bitrate overhead. CFR would force frame interval padding, wasting bandwidth.

### 3.6 Resolution Adaptation (Intel Encoding Fallback)

The Apple Silicon Media Engine hardware encoder has ample performance — from M1 to M3 Max, single-stream 1080p@60fps encoding throughput and latency are nearly identical (differences only appear in multi-stream scenarios). The bottleneck is on Intel: low-end Intel chips' Quick Sync encoders may not handle 1080p encoding in real time, causing frame rate drops. For this reason, encoding resolution is dynamically scaled based on the Mac's CPU model:

```cpp
void adjustResolutionByCPU(int32_t& width, int32_t& height) {
    auto cpuType = CPUInfo::getCPUType();
    double scale = 1.0;

    if (cpuType <= CPUType::IntelI5)       scale = (width <= 1920) ? 0.8  : 0.73;
    else if (cpuType <= CPUType::IntelI7)  scale = (width <= 2560) ? 0.9  : 0.8;
    // Apple Silicon: all Media Engine are performant enough, no resolution downscaling needed

    width  = static_cast<int32_t>(ceil(width * scale));
    height = static_cast<int32_t>(ceil(height * scale));
}
```

| CPU                   | 1080p Scale | Actual Encoding Resolution | Reason                                                    |
| --------------------- | ----------- | -------------------------- | --------------------------------------------------------- |
| Intel i5              | 0.8         | 1536×864                   | Quick Sync throughput limit                               |
| Intel i7              | 0.9         | 1728×972                   |                                                           |
| Apple M1/M2/M3 series | 1.0         | 1920×1080                  | Media Engine has no bottleneck for single-stream encoding |

### 3.7 AVCC to Annex-B Format Conversion

VideoToolbox outputs encoded frames in AVCC format (4-byte length prefix), but the casting transport SDK requires Annex-B (`0x00000001` startcode):

```cpp
void processEncodedFrame(CMSampleBufferRef sampleBuffer, bool isKeyFrame) {
    static const uint8_t startCode[] = {0x00, 0x00, 0x00, 0x01};
    std::vector<uint8_t> fullPacket;

    // Key frame: insert parameter sets first (SPS/PPS/VPS)
    if (isKeyFrame) {
        auto paramSets = getParameterSets(formatDesc);
        for (auto& ps : paramSets) {
            fullPacket.insert(end, startCode, startCode + 4);
            fullPacket.insert(end, ps.begin(), ps.end());
        }
    }

    // NAL units: length prefix → startcode
    char* data; size_t totalLen;
    CMBlockBufferGetDataPointer(blockBuffer, 0, nullptr, &totalLen, &data);

    size_t offset = 0;
    while (offset < totalLen) {
        uint32_t naluLen;
        memcpy(&naluLen, data + offset, 4);
        naluLen = CFSwapInt32BigToHost(naluLen);  // big-endian → host order

        fullPacket.insert(end, startCode, startCode + 4);
        fullPacket.insert(end, data + offset + 4, data + offset + 4 + naluLen);
        offset += 4 + naluLen;
    }

    // Callback to casting transport SDK
    frameCallback_(fullPacket.data(), fullPacket.size(), pts);
}
```

---

## 4. Reverse Control: HID Event Injection

Touch, mouse, and keyboard events from the Pad are encoded via Protobuf and sent to the Mac, where they are parsed and injected into the system using `CGEvent`.

### 4.1 Message Format

The control channel uses Protobuf to define the message structure:

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
  float x = 1;          // normalized coordinates (0.0-1.0)
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

### 4.2 Event Routing

After receiving the Protobuf message, the Mac routes it to different event simulators based on the input type:

```
HIDDispatcher.handleHIDReport(report, displayID)
  ├─ has_keyboard()    → KeyboardEventSimulator
  │   └─ Android KeyCode → CGKeyCode mapping → CGEventPost
  ├─ has_mouse()       → MouseEventSimulator
  │   ├─ move           → CGEvent(kCGEventMouseMoved)
  │   ├─ left/right click → CGEvent(kCGEventLeftMouseDown/Up)
  │   ├─ drag           → mouseMoved + isDrag
  │   └─ scroll         → CGEventCreateScrollWheelEvent
  ├─ has_touch_screen() → TouchGestureRecognizer
  │   └─ single/multi finger → tap/doubleTap/scroll/pinch → mapped to mouse events
  └─ has_stylus()      → StylusGestureRecognizer
      └─ stylus → mapped to mouse events
```

### 4.3 Gesture Recognition

TouchGestureRecognizer translates Pad touch gestures into Mac mouse operations:

| Gesture                        | CGEvent Injection                                                            |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Single / Double / Triple click | `kCGEventLeftMouseDown` + `kCGEventLeftMouseUp` + clickCount                 |
| Right click                    | `kCGEventRightMouseDown` + `kCGEventRightMouseUp`                            |
| Drag                           | `kCGEventLeftMouseDown` → `mouseMoved(isDrag: true)` → `kCGEventLeftMouseUp` |
| Move (single point)            | `kCGEventMouseMoved`                                                         |
| Scroll                         | `CGEventCreateScrollWheelEvent`                                              |
| Two-finger pinch               | `kVK_ANSI_Equal` / `kVK_ANSI_Minus` (Command +/-)                            |

```alert
type: info
description: **Limitation of two-finger pinch**: macOS 10.5+ provides the `NSEventTypeMagnify` gesture event and the `kCGGesturePhase` phase field. In theory, `CGEventCreateScrollWheelEvent` with gesture phase could simulate continuous trackpad zoom. However, in practice, programmatically constructed CGEvents undergo AppKit event source validation during conversion to `NSEvent` — behavior varies across apps, and continuous zoom cannot be triggered reliably in most apps. `Cmd +/-` as a **keyboard shortcut** behaves predictably across all apps and serves as a reliable fallback in this scenario.
```

### Comparison with Sidecar

Sidecar supports smooth trackpad-level gestures (two-finger zoom, rotation, scroll) on the Mac because it uses a higher-privilege event channel: raw touch data from the iPad is transmitted through the `SidecarCore` private framework, and the Mac side reconstructs `NSTouch` objects (`NSTouchTypeDirect`), which enter the AppKit gesture recognition pipeline directly. Apps receive these through `NSMagnificationGestureRecognizer` and `NSRotateGestureRecognizer` — identical to the built-in trackpad.

Our approach is different — Pad touch data arrives at the Mac via Protobuf over the casting transport SDK, and can only be injected as mouse/keyboard events via `CGEventPost`. `NSTouch` has no public initializer, so it is impossible to construct valid touch objects externally. This is a gap at the OS permission level, not something the transport protocol can solve.

| Aspect                 | Sidecar                                         | This Solution                         |
| ---------------------- | ----------------------------------------------- | ------------------------------------- |
| Touch data transport   | SidecarCore private channel                     | Protobuf over casting transport SDK   |
| Mac-side event type    | `NSTouch` (Direct)                              | `CGEvent` (Mouse/Keyboard)            |
| Two-finger zoom        | `NSMagnificationGestureRecognizer` (continuous) | Cmd +/- shortcuts (stepped)           |
| Two-finger rotation    | `NSRotateGestureRecognizer`                     | Not supported                         |
| Gesture continuity     | Discrete (single `.ended` callback)             | N/A (non-gesture API)                 |
| Code deployment target | Apps need gesture recognizers added             | No app adaptation needed, system-wide |

### 4.4 Coordinate Mapping

The Pad sends normalized coordinates (0.0-1.0), and the Mac maps them to actual pixel positions on the virtual display:

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

The y-coordinate needs to be flipped — the Pad coordinate system has its origin at the top-left, while macOS has it at the bottom-left.

### 4.5 Multi-touch Limitation

A maximum of 3 touch points is processed:

```objc
int size = MIN(report.touch_screen().inputs_size(), 3);
```

Reason for the limit: when switching apps on the Pad, an anomalous state of "multiple fingers pressed but not all lifted" can occur. Without a limit, unconsumed gesture events would accumulate.

---

## 5. Lessons Learned

### Screen Capture Solution Evolution

There are two approaches to recording a virtual display on macOS:

| Approach             | API                                         | Pros                                             | Cons                                         |
| -------------------- | ------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| AVCaptureScreenInput | `AVCaptureSession` + `AVCaptureScreenInput` | System-level capture, automatic color management | Forces mirror mode causing black screen      |
| CGDisplayStream      | `CGDisplayStreamCreateWithDispatchQueue`    | Zero-copy IOSurface, bypasses window compositor  | Requires manual format conversion management |

The `AVCaptureScreenInput` approach was tried initially, but it was found that on some macOS versions, the virtual display would trigger a black screen — AVCapture internally tries to reconfigure the display mode. The final solution switched to `CGDisplayStream`, reading frames directly from IOSurface, avoiding the side effects of system-level capture and achieving lower latency (zero-copy).

### Encoding Performance Optimization: 130ms → 14ms

In the early days of the encoder, actual encoding latency on the M3 Pro was as high as 130ms, with a frame rate of only 28 FPS. Investigation revealed two key issues:

**1. `kVTCompressionPropertyKey_EnableLowLatencyRateControl` blocked the encoding pipeline.** This parameter actually limited the hardware encoder's throughput on Apple Silicon — removing this restriction reduced latency from 130ms to approximately 50ms.

**2. `CGDisplayStream`'s `QueueDepth = 5` caused a 5-frame buffering delay.** Reducing it to 1 sent captured frames directly to the encoder with no queuing — latency dropped from 50ms further to 14ms.

Final performance: 57 FPS @ 1080p H.265 on M3 Pro, median encoding latency 14ms, GPU usage 26% (confirming hardware acceleration was active).

### Long GOP Strategy

Desktop casting content is mostly static (documents, code editors, the desktop). An IDR every 60 frames means sending an oversized keyframe every second (many times larger than a P-frame), which is a pure waste of bandwidth in static scenes. Stretching this to 15000 frames (approximately 250 seconds) means the encoder almost never produces IDR frames when there are no visual changes, resulting in stable bitrate and smooth video. LAN Wi-Fi has a very low packet loss rate (<0.1%), and the Jitter Buffer can handle occasional packet loss, so frequent IDR frames for loss recovery are unnecessary.

### Reverse Control Touch Sampling Rate Downscaling

Similar to the previous article on phone-to-Mac screen casting, the Pad's touch sampling rate (120-240Hz) is far higher than the Mac's CGEvent injection consumption capacity. Sending every `mouseDragged` event causes them to queue up in the event queue, leading to operational latency. The solution: reduce the touch drag event sampling rate to one quarter on the Pad side, balancing smoothness and response latency.

### iPhone Mirroring and Pad Reverse Control Nested Lag

macOS Sequoia introduced iPhone Mirroring — an iPhone mirror window appears on the Mac. When the user controls the Mac via the Pad, if the touch falls within the iPhone Mirroring window, a two-layer nesting occurs: Pad touch → Mac CGEvent → iPhone Mirroring (another layer of touch injection into the iPhone) → the touch sampling rates and event queues of both layers stack, amplifying latency. The root cause is still the touch sampling rate — after high-frequency CGEvent injection from the Pad undergoes secondary forwarding through iPhone Mirroring, the internal touch pipeline backup becomes more severe. The current solution is unified downsampling on the Pad side, prioritizing smoothness in basic scenarios.

### Black Screen After Pad Wake from Sleep

After the Pad screen turns off for a while and is turned back on, the casting screen is black. The cause is that the Pad's decoder is released by the system during screen-off, and when the decoding context is rebuilt upon wake, there is no IDR frame — the Mac encoder is unaware of this and continues sending P-frames normally, but the Pad decoder lacks the keyframe needed to reconstruct the reference image, freezing the画面.

Fix: the Pad sends an IDR request to the Mac through the casting transport SDK's control channel after waking, triggering `MCVideoPlugin::onRequestIDR()`:

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

When the Mac encoder receives the request, it forces the next frame to output an IDR (carrying SPS/PPS/VPS). The Pad decoder receives the complete parameter set plus the keyframe, rebuilds the decoding context, and the display immediately resumes.

### Screen Recording Permission Denied: No Re-prompt

On first launch of screen recording, macOS displays a system authorization dialog requesting "Screen Recording" permission. If the user denies it the first time, subsequent calls to `CGDisplayStreamStart` will not re-trigger the system authorization prompt — the system silently returns authorization failure, the application receives no frames, and there is no way to guide the user back.

macOS's authorization mechanism dictates: once the user makes a choice (allow/deny) regarding a permission, the system will not proactively prompt again. The user must manually enable it in "System Settings > Privacy & Security > Screen Recording". Therefore, the application must detect the authorization status itself and guide the user:

```objc
// Check screen recording authorization status
BOOL hasPermission = CGPreflightScreenCaptureAccess();

if (!hasPermission) {
    // Has been denied (or not yet chosen) → show custom dialog to guide user to System Settings
    [self showCustomPermissionAlert:^{
        [[NSWorkspace sharedWorkspace] openURL:
            [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"]];
    }];
} else {
    // Already authorized, start capture normally
    [self startCapture];
}
```

`CGPreflightScreenCaptureAccess()` only checks without triggering the dialog; `CGRequestScreenCaptureAccess()` triggers the first-time system dialog — but only works if the user has never made a choice. After denial, only a custom dialog plus a redirect to System Settings can guide the user to enable it manually. Screen casting applications must handle this path before shipping, otherwise users who deny on first launch will have virtually no way to recover.

### Mirror Mode Conflict

After the virtual display is created, the Mac recognizes it as an independent extended screen. However, there is one reproducible scenario: when a Mac connected to an external monitor disconnects from it — the system loses a display output target and attempts to mirror to the virtual display (`CGDisplayIsInMirrorSet` returns true), causing the cast image to display abnormally.

Fix: register `CGDisplayRegisterReconfigurationCallback` to monitor display state changes. When the virtual display enters mirror mode, call `CGConfigureDisplayMirrorOfDisplay(display, kCGNullDirectDisplay)` to force it back to extended mode. On failure, retry with a delay and do not block the main flow.

---

## 6. Summary

The architecture of Mac-to-Android Pad screen casting is the reverse of the common "phone-to-PC" approach, with the key differences on the Mac side:

1. **Virtual Display**: CGDIsplayVirtual creates an independent desktop space, CGDisplayStream provides zero-copy capture
2. **Encoding Engine**: VideoToolbox hardware encoding, VBR + VFR adapted for desktop casting, single Session + lazy rebuild covers exceptional paths
3. **Intel Encoding Fallback**: Apple Silicon's Media Engine is performant across the board; only low-end Intel chips get dynamic resolution downscaling
4. **Reverse Control Injection**: Protobuf messages → gesture recognition → CGEvent injection into the system, covering touch, mouse, keyboard, and stylus
