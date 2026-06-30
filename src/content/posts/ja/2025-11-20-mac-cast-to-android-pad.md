---
title: 'Mac 画面を Android Pad にキャストするアーキテクチャ実装'
pubDate: 2025-11-20
categories: [オーディオ/ビデオ]
tags:
  - 画面ミラーリング
  - VideoToolbox
  - HID

toc: true
description: 'Mac画面をAndroid Padにキャストする仮想ディスプレイ、VideoToolboxエンコード、HID逆操作注入のアーキテクチャ実装解説。'
---

## はじめに

Apple の Sidecar は Mac 画面を iPad に拡張し、iPad から Mac をタッチ操作できます。しかし Sidecar は Apple エコシステム限定です——Android Pad でも同じ体験を実現できるでしょうか？

本記事では、Xiaomi タブレットを例に、**Mac を Source 端、Android Pad を Sink 端**とする画面キャストのアーキテクチャ実装を分析し、Sidecar と同等のアプローチを検討します。中核となる課題は、Mac 側で画面を透過的にキャプチャする方法、限られた帯域幅でスムーズに動作するエンコードパラメータの選定、そして Pad 側のタッチ操作を Mac に正確にマッピングする方法です。

## 一、全体アーキテクチャ

```
┌─ Source 端（Mac）──────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─ プラットフォーム層 ──────────────────────────────────────────────┐ │
│  │  仮想ディスプレイ (CGVirtualDisplay) → 画面キャプチャ (CGDisplayStream) │
│  │       ↓ IOSurface → CVPixelBuffer → CMSampleBuffer                │
│  │  VideoToolbox ハードウェアエンコード (H.265/H.264)                  │
│  └────────────────────────────┬──────────────────────────────────────┘ │
│                               ▼                                         │
│  ┌─ キャスト伝送 SDK (Server モード) ──────────────────────────────┐ │
│  │  RTSP + RTP → AES 暗号化 → MPT 転送層 → 送信                    │
│  │  ← Pad からのフィードバック受信：パケットロス率 / IDR 要求         │
│  └──────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Wi-Fi
                                   ▼
┌─ Sink 端（Android Pad）────────────────────────────────────────────────┐
│  ┌─ キャスト伝送 SDK (Client モード) ───────────────────────────────┐ │
│  │  受信 → 復号 → RTP 再構成 → デコードコールバック                    │
│  │  → Source へフィードバック：パケットロス率統計 / IDR 要求           │
│  └────────────────────────────┬─────────────────────────────────────┘ │
│                               ▼                                         │
│  ┌─ プラットフォーム層（Android）─────────────────────────────────────┐ │
│  │  動画デコード（ハードウェア）→ レンダリング → 画面表示               │
│  │  逆操作：タッチキャプチャ → HID エンコード → Protobuf → キャスト伝送 SDK 送信 │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

[前回の記事「携帯画面を Mac にキャスト」](/posts/zh/android-screen-mirroring-architecture/)とは逆に、Mac が Source 端となり、**画面キャプチャ**と**エンコード送信**を担当します。

### キャスト伝送 SDK

基盤にはクロスプラットフォームのキャスト伝送 SDK（C++ 実装、Android/macOS/iOS/Windows 共通）を使用します。SDK は Server-Client モデルを採用しており、Mac 側は **Server モード**で動作します。動画/音声エンコードプラグインを登録 → `setAttribute` でエンコードパラメータを設定 → プラグインがエンコードフレームを出力後、`write()` を呼び出して送信します。Pad 側は Client として受信、デコード、レンダリングを行います。SDK の中核メカニズムは前回の記事で詳述していますので、本記事では Mac 側特有の設計に焦点を当てます。Pad を Sidecar 的に使用するシナリオでは、音声は Mac のローカルスピーカー/ヘッドフォンから出力されるため、音声のキャプチャと転送は行いません。

---

## 二、画面キャプチャ：仮想ディスプレイ

Mac 画面キャストの中核的な課題は、メインディスプレイをミラーリングせずに、独立して画面をキャプチャする方法です。その答えは `CGVirtualDisplay` を使用して仮想ディスプレイを作成することです——これは Sidecar と同じアプローチです。

### 2.1 なぜ仮想ディスプレイが必要か

```
物理ディスプレイ (2560x1440)    仮想ディスプレイ (1920x1080)
┌─────────────────────┐        ┌──────────────────┐
│                     │        │                  │
│     メイン作業領域    │        │  Pad 拡張デスクトップ│
│                     │        │                  │
└─────────────────────┘        └──────────────────┘
```

メインディスプレイを直接キャプチャするには 2 つの欠点があります。解像度の不一致（メインディスプレイは 2K/4K だが Pad は 1080p で十分）、およびユーザーのウィンドウ操作がキャスト内容に干渉することです。仮想ディスプレイは独立したデスクトップ空間を作成します——Mac は自動的に拡張ディスプレイとして認識し、Pad にはこの仮想ディスプレイ上のウィンドウのみが表示され、互いに干渉しません。

### 2.2 仮想ディスプレイの作成

macOS 10.13+ は `CGVirtualDisplay` プライベートフレームワークを提供しています：

```objc
CGVirtualDisplayDescriptor *descriptor = [[CGVirtualDisplayDescriptor alloc] init];
descriptor.name = @"Virtual Display";
descriptor.maxPixelsWide = 3840;
descriptor.maxPixelsHigh = 2160;
descriptor.productID = 0x1234;
descriptor.vendorID = 0x3456;
descriptor.serialNum = 0x0001;

// 物理サイズは PPI から計算
CGFloat pixelsPerMillimeter = 110.0 / 25.4;  // 約 110 PPI
descriptor.sizeInMillimeters = CGSizeMake(
    ceil(scaledWidth / pixelsPerMillimeter),
    ceil(scaledHeight / pixelsPerMillimeter));

CGVirtualDisplaySettings *settings = [[CGVirtualDisplaySettings alloc] init];
settings.hiDPI = 1;
settings.modes = @[
    [[CGVirtualDisplayMode alloc] initWithWidth:scaledWidth
                                         height:scaledHeight
                                    refreshRate:60],
    // フォールバック解像度
    [[CGVirtualDisplayMode alloc] initWithWidth:scaledWidth * 4 / 5
                                         height:scaledHeight * 4 / 5
                                    refreshRate:60],
];

CGVirtualDisplay *virtualDisplay = [[CGVirtualDisplay alloc] initWithDescriptor:descriptor];
BOOL success = [virtualDisplay applySettings:settings];
CGDirectDisplayID displayID = virtualDisplay.displayID;
```

作成に成功すると、システム設定に仮想ディスプレイが表示され、ユーザーは Pad の拡張デスクトップにウィンドウをドラッグできるようになります。

```alert
type: info
description: `CGVirtualDisplay` はプライベートフレームワークであり、App Store への提出には適していません。Sidecar はより低レベルの SidecarCore フレームワーク + AirPlay 伝送を使用しており、原理は似ていますが実装が異なります。
```

### 2.3 CGDisplayStream によるキャプチャ

`CGDisplayStream` を使用して仮想ディスプレイから画面をキャプチャし、出力形式は `kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange`（NV12）です：

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
    streamQueue,  // シリアルキュー
    ^(CGDisplayStreamFrameStatus status,
      uint64_t displayTime,
      IOSurfaceRef frameSurface,
      CGDisplayStreamUpdateRef updateRef) {

        if (status != kCGDisplayStreamFrameStatusFrameComplete || !frameSurface) {
            return;
        }

        // IOSurface → CVPixelBuffer → CMSampleBuffer（ゼロコピー）
        CVPixelBufferRef pixelBuffer = NULL;
        CVPixelBufferCreateWithIOSurface(kCFAllocatorDefault, frameSurface, NULL, &pixelBuffer);

        CMTime pts = CMTimeMake(CACurrentMediaTime() * 1000000, 1000000);
        CMSampleBufferRef sampleBuffer = NULL;
        CMSampleBufferCreateForImageBuffer(kCFAllocatorDefault, pixelBuffer,
            YES, NULL, NULL, formatDesc, &timingInfo, &sampleBuffer);

        // エンコーダにコールバック
        callback(sampleBuffer);

        CFRelease(sampleBuffer);
        CVPixelBufferRelease(pixelBuffer);
    }];
```

`IOSurface → CVPixelBuffer → CMSampleBuffer` の全チェーンはゼロコピーです——同じ GPU メモリを共有し、VideoToolbox がエンコードするまで初めてデータが読み込まれます。

### 2.4 ミラーモード保護

仮想ディスプレイは自動的に拡張ディスプレイとして認識されますが、特定のシナリオではシステムが自動的にミラーモードに切り替わることがあります。`CGDisplayRegisterReconfigurationCallback` を登録して監視し、ミラーリングを検出したら強制的に拡張モードに戻します：

```c
// ファイルレベルの static 変数、ミラーリング切り替え処理中かどうかをマーク（再入防止）
static BOOL isHandlingDisplayChange = NO;

// 再設定コールバックを監視
CGDisplayRegisterReconfigurationCallback(reconfigCallback, (void *)displayID);

static void reconfigCallback(CGDirectDisplayID display,
                             CGDisplayChangeSummaryFlags flags,
                             void *userInfo) {
    CGDirectDisplayID targetID = (CGDirectDisplayID)(uintptr_t)userInfo;
    if (display != targetID || isHandlingDisplayChange) return;

    if (CGDisplayIsInMirrorSet(display)) {
        isHandlingDisplayChange = YES;
        // 強制的にミラーモードを解除
        CGDisplayConfigRef configRef;
        CGBeginDisplayConfiguration(&configRef);
        CGConfigureDisplayMirrorOfDisplay(configRef, display, kCGNullDirectDisplay);
        CGCompleteDisplayConfiguration(configRef, kCGConfigurePermanently);
        isHandlingDisplayChange = NO;
    }
}
```

---

## 三、VideoToolbox エンコードエンジン

### 3.1 エンコードチェーン

```
CGDisplayStream が CMSampleBuffer (NV12) をキャプチャ
       ↓
VTVideoEncoder.encodeFrame()
       ↓
VTCompressionSessionEncodeFrame() → エンコード出力 CMSampleBuffer (H.264/H.265)
       ↓
processEncodedFrame():
  - キーフレーム：SPS/PPS/VPS パラメータセットを挿入
  - AVCC 形式 → Annex-B 形式（長さプレフィックス → startcode 0x00000001）
       ↓
frameCallback_() → MCServer.write() → キャスト伝送 SDK → ネットワーク
```

### 3.2 単一 Session + レイジー再構築

エンコーダは単一の `VTCompressionSession` を使用し、初期化時に作成、破棄されるまで再利用し続けます。Mac がスリープから復帰して GPU コンテキストが無効になった場合、ただ一度だけレイジーに再構築します：

```cpp
class VTVideoEncoder {
    VTCompressionSessionRef session_{nullptr};

    void encodeFrame(CMSampleBufferRef sampleBuffer) {
        OSStatus status = VTCompressionSessionEncodeFrame(
            session_, pixelBuffer, pts, kCMTimeInvalid, nullptr, nullptr, &infoFlags);

        // GPU リセット後のみ 1 回再構築、唯一の異常パスをカバー
        if (status == kVTInvalidSessionErr || status == kVTCompressionSessionHardwareError) {
            destroySession(session_);
            createSession(session_);
            status = VTCompressionSessionEncodeFrame(
                session_, pixelBuffer, pts, kCMTimeInvalid, nullptr, nullptr, &infoFlags);
        }
        if (status != noErr) {
            // フレームドロップ + ログ出力、キャプチャスレッドはブロックしない
        }
    }
};
```

画面キャストシナリオではエンコードパラメータは固定（仮想ディスプレイの解像度は作成後変化しない）であり、Session の再構築が発生する確率は極めて低いです。二重 Session による「ゼロ切り替え」の利点が発揮されるシナリオはなく、単一 Session + レイジー再構築のほうがシンプルです。

### 3.3 エンコードパラメータの選定

```cpp
void configureEncoderProperties(VTCompressionSessionRef session) {
    // 1. RealTime モード — エンコード速度を優先
    VTSessionSetProperty(session, kVTCompressionPropertyKey_RealTime, kCFBooleanTrue);

    // 2. B フレームの並べ替えを禁止 — エンコーダ内部のバッファ遅延を排除
    VTSessionSetProperty(session, kVTCompressionPropertyKey_AllowFrameReordering, kCFBooleanFalse);

    // 3. エンコーダ遅延を制限 — 最大 1 フレームの参照を保持
    int32_t maxFrameDelay = 1;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxFrameDelayCount,
        CFNumberCreate(nullptr, kCFNumberSInt32Type, &maxFrameDelay));

    // 4. キーフレーム間隔 — 画面キャストは静止画主体、長い GOP でキーフレームのオーバーヘッド削減
    int32_t gopSize = 15000;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxKeyFrameInterval,
        CFNumberCreate(nullptr, kCFNumberSInt32Type, &gopSize));
    VTSessionSetProperty(session, kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration,
        CFNumberCreate(nullptr, kCFNumberFloatType, (float[]){300.0f}));

    // 5. エンコード品質 — 0.7、画質とエンコード速度のバランス
    float quality = 0.7;
    VTSessionSetProperty(session, kVTCompressionPropertyKey_Quality,
        CFNumberCreate(nullptr, kCFNumberFloat32Type, &quality));
}
```

### 3.4 VBR ビットレート戦略

VBR（可変ビットレート）を使用し、解像度に応じて基本ビットレートを動的に計算します：

```cpp
// Table-driven — 解像度ごとに異なる bit/pixel 係数を使用
struct BitrateConfig {
    int maxPixels;
    double hevcFactor;  // H.265 は圧縮率が高く、係数が小さい
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

// 基本ビットレート = pixelCount × factor
int64_t baseBitrate = static_cast<int64_t>(pixelCount * factor);

// 動的範囲：基本ビットレートの 40% ~ 150%
int64_t minBitrate = baseBitrate * 0.4;
int64_t maxBitrate = baseBitrate * 1.5;

CFArrayRef range = CFArrayCreate(...);
VTSessionSetProperty(session, kVTCompressionPropertyKey_DataRateLimits, range);
```

1080p H.265 の場合：`1920 × 1080 × 2.0 = 4,147,200 bps ≈ 4 Mbps`、動的範囲は 1.6 ~ 6.2 Mbps です。

**VBR を選び、CBR を選ばない理由：**

| 観点                 | VBR                                             | CBR                                |
| -------------------- | ----------------------------------------------- | ---------------------------------- |
| 静止画               | ビットレート低下、帯域幅節約                    | 無効データを詰め込み、帯域幅を浪費 |
| 動画                 | ビットレートがピークに、画質優先                | 画質低下が顕著                     |
| 画面キャストの適合性 | ✅ 最適（デスクトップはほとんどの時間静止状態） | 非推奨                             |
| GOP サイズ大         | ビットレート変動大だが上限超過なし              | 安定しているがリソースを浪費       |

画面キャストの映像は主に静止コンテンツ（ドキュメント、デスクトップ）であり、VBR の帯域幅利用率は CBR をはるかに上回ります。`DataRateLimits` の上下限制約により、ビットレートが制御不能になることはありません。

### 3.5 VFR フレームレート

エンコーダは VFR（可変フレームレート）を使用します——フレーム継続時間は `kCMTimeInvalid`、`ExpectedFrameRate = 0`：

```cpp
float frameRate = 0.0f;
VTSessionSetProperty(session, kVTCompressionPropertyKey_ExpectedFrameRate,
    CFNumberCreate(nullptr, kCFNumberFloat32Type, &frameRate));
```

VFR はデスクトップ画面キャストのシナリオで明確な利点があります。静止画の場合、キャプチャ側がフレームをスキップすることがあり、VFR はエンコーダが空白フレームを直接スキップできるため、不要な P フレームやビットレートのオーバーヘッドが発生しません。CFR ではフレーム間隔を強制的に埋めるため、帯域幅を浪費します。

### 3.6 解像度の自動適応（Intel エンコード能力のフォールバック）

Apple Silicon の Media Engine ハードウェアエンコーダの性能は十分です——M1 から M3 Max まで、単一チャンネルの 1080p@60fps エンコードのスループットとレイテンシはほぼ同じです（差があるのは複数チャンネルの並列処理のみ）。ボトルネックは Intel 側にあります。低スペック Intel チップの Quick Sync エンコーダは 1080p エンコードをリアルタイムで完了できず、フレームレートが低下する可能性があります。そのため、Mac の CPU モデルに応じてエンコード解像度を動的にスケーリングします：

```cpp
void adjustResolutionByCPU(int32_t& width, int32_t& height) {
    auto cpuType = CPUInfo::getCPUType();
    double scale = 1.0;

    if (cpuType <= CPUType::IntelI5)       scale = (width <= 1920) ? 0.8  : 0.73;
    else if (cpuType <= CPUType::IntelI7)  scale = (width <= 2560) ? 0.9  : 0.8;
    // Apple Silicon 全シリーズの Media Engine 性能は十分であり、解像度を下げる必要なし

    width  = static_cast<int32_t>(ceil(width * scale));
    height = static_cast<int32_t>(ceil(height * scale));
}
```

| CPU                       | 1080p スケール | 実際のエンコード解像度 | 理由                                                    |
| ------------------------- | -------------- | ---------------------- | ------------------------------------------------------- |
| Intel i5                  | 0.8            | 1536×864               | Quick Sync スループット上限                             |
| Intel i7                  | 0.9            | 1728×972               |                                                         |
| Apple M1/M2/M3 全シリーズ | 1.0            | 1920×1080              | Media Engine 単一チャンネルエンコードにボトルネックなし |

### 3.7 AVCC → Annex-B 形式変換

VideoToolbox が出力するエンコードフレームは AVCC 形式（4 バイト長さプレフィックス）ですが、キャスト伝送 SDK は Annex-B（`0x00000001` startcode）を要求します：

```cpp
void processEncodedFrame(CMSampleBufferRef sampleBuffer, bool isKeyFrame) {
    static const uint8_t startCode[] = {0x00, 0x00, 0x00, 0x01};
    std::vector<uint8_t> fullPacket;

    // キーフレーム：まずパラメータセットを挿入（SPS/PPS/VPS）
    if (isKeyFrame) {
        auto paramSets = getParameterSets(formatDesc);
        for (auto& ps : paramSets) {
            fullPacket.insert(end, startCode, startCode + 4);
            fullPacket.insert(end, ps.begin(), ps.end());
        }
    }

    // NAL ユニット：長さプレフィックス → startcode
    char* data; size_t totalLen;
    CMBlockBufferGetDataPointer(blockBuffer, 0, nullptr, &totalLen, &data);

    size_t offset = 0;
    while (offset < totalLen) {
        uint32_t naluLen;
        memcpy(&naluLen, data + offset, 4);
        naluLen = CFSwapInt32BigToHost(naluLen);  // ビッグエンディアン → ホストバイトオーダー

        fullPacket.insert(end, startCode, startCode + 4);
        fullPacket.insert(end, data + offset + 4, data + offset + 4 + naluLen);
        offset += 4 + naluLen;
    }

    // キャスト伝送 SDK にコールバック
    frameCallback_(fullPacket.data(), fullPacket.size(), pts);
}
```

---

## 四、逆操作：HID イベント注入

Pad 側のタッチ/マウス/キーボードイベントは Protobuf でエンコードされて Mac に送信され、Mac 側で解析後、`CGEvent` を使用してシステムに注入されます。

### 4.1 メッセージ形式

制御チャンネルは Protobuf を使用してメッセージ構造を定義します：

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
  float x = 1;          // 正規化座標 (0.0-1.0)
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

### 4.2 イベントルーティング

Mac 側で Protobuf メッセージを受信後、入力タイプに応じて異なるイベントシミュレータにルーティングします：

```
HIDDispatcher.handleHIDReport(report, displayID)
  ├─ has_keyboard()    → KeyboardEventSimulator
  │   └─ Android KeyCode → CGKeyCode マッピング → CGEventPost
  ├─ has_mouse()       → MouseEventSimulator
  │   ├─ 移動           → CGEvent(kCGEventMouseMoved)
  │   ├─ 左/右クリック   → CGEvent(kCGEventLeftMouseDown/Up)
  │   ├─ ドラッグ        → mouseMoved + isDrag
  │   └─ スクロール      → CGEventCreateScrollWheelEvent
  ├─ has_touch_screen() → TouchGestureRecognizer
  │   └─ 単/複数指 → tap/doubleTap/scroll/pinch → マウスイベントにマッピング
  └─ has_stylus()      → StylusGestureRecognizer
      └─ スタイラス → マウスイベントにマッピング
```

### 4.3 ジェスチャ認識

TouchGestureRecognizer は Pad 側のタッチジェスチャを Mac 側のマウス操作に変換します：

| ジェスチャ                       | CGEvent 注入                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------- |
| シングル/ダブル/トリプルクリック | `kCGEventLeftMouseDown` + `kCGEventLeftMouseUp` + clickCount                 |
| 右クリック                       | `kCGEventRightMouseDown` + `kCGEventRightMouseUp`                            |
| ドラッグ                         | `kCGEventLeftMouseDown` → `mouseMoved(isDrag: true)` → `kCGEventLeftMouseUp` |
| 移動（単点）                     | `kCGEventMouseMoved`                                                         |
| スクロール                       | `CGEventCreateScrollWheelEvent`                                              |
| ピンチズーム（2 本指）           | `kVK_ANSI_Equal` / `kVK_ANSI_Minus`（Command +/-）                           |

```alert
type: info
description: **ピンチズームの制限**：macOS 10.5+ は `NSEventTypeMagnify` ジェスチャイベントと `kCGGesturePhase` 位相フィールドを提供しており、理論上は `CGEventCreateScrollWheelEvent` + ジェスチャ位相でトラックパッドの連続ズームをシミュレートできます。しかし実際のテストでは、プログラムで構築した CGEvent を `NSEvent` に変換する際に AppKit のイベントソース検証を通過する必要があり——アプリによって動作が異なり、連続ズームはほとんどのアプリで安定してトリガーできませんでした。`Cmd +/-` は**キーボードショートカット**としてすべてのアプリで予測可能な動作を提供するため、現在のシナリオにおける信頼性の高いフォールバック手段です。
```

### Sidecar との比較

Sidecar が Mac 側でトラックパッドレベルのスムーズなジェスチャ（ピンチズーム、回転、スクロール）をサポートできるのは、より高権限のイベントチャンネルを利用しているためです。iPad 側の生のタッチデータは `SidecarCore` プライベートフレームワークを通じて転送され、Mac 側で受信後、OS によって `NSTouch` オブジェクト（`NSTouchTypeDirect`）が再構築され、直接 AppKit のジェスチャ認識パイプラインに入ります。アプリは `NSMagnificationGestureRecognizer` や `NSRotateGestureRecognizer` でこれを受け取ります——内蔵トラックパッドと完全に同じです。

私たちのアプローチは異なります——Pad のタッチデータは Protobuf 経由でキャスト伝送 SDK を通じて Mac に到達し、`CGEventPost` によるマウス/キーボードイベントの注入しかできません。`NSTouch` には公開されたイニシャライザがなく、外部から正当なタッチオブジェクトを構築することはできません。これは OS 権限レベルの差であり、伝送プロトコルで解決できるものではありません。

| 観点                 | Sidecar                                    | 本方式                                 |
| -------------------- | ------------------------------------------ | -------------------------------------- |
| タッチデータ伝送     | SidecarCore プライベートチャンネル         | Protobuf over キャスト伝送 SDK         |
| Mac 側イベントタイプ | `NSTouch` (Direct)                         | `CGEvent` (Mouse/Keyboard)             |
| ピンチズーム         | `NSMagnificationGestureRecognizer`（連続） | Cmd +/- ショートカット（ステップ）     |
| 2 本指回転           | `NSRotateGestureRecognizer`                | 非対応                                 |
| ジェスチャの連続性   | 離散的（単発 `.ended` コールバック）       | N/A（非ジェスチャ API）                |
| コード導入ターゲット | アプリにジェスチャ認識器の追加が必要       | アプリの適応不要、システムレベルで有効 |

### 4.4 座標マッピング

Pad 側は正規化座標 (0.0-1.0) を送信し、Mac 側は仮想ディスプレイの実際のピクセル位置にマッピングします：

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

y 座標は反転が必要です——Pad の座標系は左上原点、macOS は左下原点です。

### 4.5 マルチタッチの制限

最大 3 つのタッチポイントまで処理します：

```objc
int size = MIN(report.touch_screen().inputs_size(), 3);
```

制限の理由：Pad 側でアプリを切り替える際に、「複数指で押したまま全てが離されていない」という異常状態が発生する可能性があり、制限しないと未消費のジェスチャイベントが蓄積されるためです。

---

## 五、ハマりポイント集

### 画面キャプチャ方式の変遷

macOS で仮想ディスプレイの画面を録画するには 2 つの方式があります：

| 方式                 | API                                         | メリット                                                 | デメリット                                 |
| -------------------- | ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| AVCaptureScreenInput | `AVCaptureSession` + `AVCaptureScreenInput` | システムレベルキャプチャ、自動カラーマネジメント         | ミラーモードが強制されてブラックスクリーン |
| CGDisplayStream      | `CGDisplayStreamCreateWithDispatchQueue`    | ゼロコピー IOSurface、ウィンドウコンポジターを経由しない | 手動での形式変換が必要                     |

当初は `AVCaptureScreenInput` 方式を試しましたが、特定の macOS バージョンで仮想ディスプレイがブラックスクリーンを引き起こすことが判明しました——AVCapture 内部でディスプレイモードの再設定が試みられるためです。最終的に `CGDisplayStream` に変更し、IOSurface から直接フレームを読み取ることで、システムレベルキャプチャの副作用を回避し、レイテンシも低減しました（ゼロコピー）。

### エンコードパフォーマンス最適化：130ms → 14ms

エンコーダ導入初期、M3 Pro 上で実測のエンコードレイテンシは 130ms に達し、フレームレートはわずか 28FPS でした。調査の結果、2 つの重要な問題が判明しました：

**1. `kVTCompressionPropertyKey_EnableLowLatencyRateControl` がエンコードパイプラインをブロックしていました。** このパラメータは Apple Silicon 上でむしろハードウェアエンコーダのスループットを制限していました——この制限を解除すると、レイテンシは 130ms から約 50ms に低下しました。

**2. `CGDisplayStream` の `QueueDepth = 5` により 5 フレームのバッファ遅延が発生していました。** これを 1 に下げると、キャプチャフレームは直接エンコーダに送られ、中間での待ち行列がなくなり、レイテンシは 50ms からさらに 14ms に低下しました。

最終パフォーマンス：M3 Pro 上で 57FPS @ 1080p H.265、エンコードレイテンシ中央値 14ms、GPU 使用率 26%（ハードウェアアクセラレーションが正常に動作していることを確認）。

### 長い GOP 戦略

デスクトップ画面キャストのほとんどの時間は静止画（ドキュメント、コードエディタ、デスクトップ）です。60 フレームごとに IDR を送信するということは、1 秒ごとに巨大なキーフレーム（P フレームの数倍）を送信することになり、静止画シナリオでは純粋に帯域幅の無駄です。15000 フレーム（約 250 秒）に延長することで、エンコーダは画面に変化がない場合にほとんど IDR を生成せず、ビットレートが安定し、画面もスムーズになります。LAN Wi-Fi のパケットロス率は非常に低く（<0.1%）、Jitter Buffer で偶発的なパケットロスを処理できるため、頻繁な IDR によるロスリカバリは必要ありません。

### 逆操作のタッチサンプリングレート低減

前回の「携帯画面を Mac にキャスト」と同様に、Pad 側のタッチサンプリングレート（120-240Hz）は Mac 側の CGEvent 注入の消費能力をはるかに上回ります。`mouseDragged` イベントを全量送信するとイベントキューで待機が発生し、操作遅延につながります。対策として、Pad 側でタッチスライドイベントのサンプリングレートを 4 分の 1 に低減し、滑らかさと応答遅延のバランスを取っています。

### iPhone Mirroring と Pad 逆操作のネストによるカクツキ

macOS Sequoia は iPhone Mirroring を導入しました——Mac 上に iPhone のミラーリングウィンドウが表示されます。ユーザーが Pad で Mac を逆操作する際に、タッチ操作が iPhone Mirroring ウィンドウ内にあると、2 層のネストが発生します：Pad のタッチ → Mac CGEvent → iPhone Mirroring（さらにタッチ注入が iPhone に送られる）→ 2 層のタッチサンプリングレートとイベントキューが重なり、レイテンシが増幅されます。根本原因はやはりタッチサンプリングレートです——Pad 側の高頻度 CGEvent 注入が iPhone Mirroring による二次転送を経由した後、内部のタッチパイプラインでより深刻な滞留が発生します。現在の解決策は Pad 側で一元的にダウンサンプリングし、基本的なシナリオの滑らかさを優先して確保することです。

### Pad 画面消灯後の復帰でブラックスクリーン

Pad 側が一定時間画面消灯した後に再び点灯すると、キャスト画面が真っ暗になります。原因は、Pad 側のデコーダが画面消灯中にシステムによって解放され、復帰後にデコードコンテキストを再構築する際に IDR フレームがないことです——Mac 側のエンコーダはそのことを全く知らずに通常通り P フレームを送信し続けるため、Pad デコーダはキーフレームがなく参照画像を再構築できず、画面がフリーズします。

修正：Pad 側は復帰後、キャスト伝送 SDK の制御チャンネルを通じて Mac 側に IDR リクエストを送信し、`MCVideoPlugin::onRequestIDR()` をトリガーします：

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

Mac エンコーダがリクエストを受信すると、次のフレームで強制的に IDR（SPS/PPS/VPS 付き）を出力します。Pad デコーダは完全なパラメータセットとキーフレームを受信した後、デコードコンテキストを再構築し、画面が直ちに復旧します。

### スクリーンキャプチャ許可拒否後に再表示されない

初回起動時にスクリーンキャプチャを開始すると、macOS は「画面収録」の許可を求めるシステム承認ダイアログを表示します。ユーザーが初回で拒否した場合、次回 `CGDisplayStreamStart` を呼び出しても、システムは承認プロンプトを再表示しません——システムは静かに承認失敗を返し、アプリケーションレベルでは画面を取得できず、ユーザーを再度導く入口もありません。

macOS の承認メカニズムの仕様として、ユーザーがある権限について選択（許可/拒否）を行うと、システムは再度ダイアログを表示しません。ユーザーが手動で「システム設定 > プライバシーとセキュリティ > 画面収録」から有効にする必要があります。そのため、アプリ側で自ら承認状態を検出し、ユーザーをガイドする必要があります：

```objc
// 画面収録の承認状態を検出
BOOL hasPermission = CGPreflightScreenCaptureAccess();

if (!hasPermission) {
    // すでに拒否されている（または未選択）→ カスタムダイアログを表示してシステム設定へ誘導
    [self showCustomPermissionAlert:^{
        [[NSWorkspace sharedWorkspace] openURL:
            [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"]];
    }];
} else {
    // 承認済み、通常通りキャプチャを開始
    [self startCapture];
}
```

`CGPreflightScreenCaptureAccess()` は検出のみでダイアログは表示しません。`CGRequestScreenCaptureAccess()` を呼ぶと初回のシステムダイアログが表示されますが、これはユーザーが一度も選択を行ったことがない場合のみ有効です。拒否された後は、カスタムダイアログ + システム設定への遷移でユーザーに手動で有効化を促すしかありません。キャスト系アプリケーションはリリース前に必ずこのパスを適切に処理する必要があります。そうしないと、ユーザーが初回で拒否した後、基本的に自力では復旧できなくなります。

### ミラーモードの競合

仮想ディスプレイ作成後、Mac はそれを独立した拡張ディスプレイとして認識します。しかし、再現可能なシナリオとして、Mac が外部ディスプレイに接続した後に切断すると、システムが表示出力先を失い、仮想ディスプレイに画面をミラーリングしようとします（`CGDisplayIsInMirrorSet` が true を返す）。これによりキャスト画面が異常になります。

修正：`CGDisplayRegisterReconfigurationCallback` を登録して表示状態の変化を監視し、仮想ディスプレイがミラーモードに入ったことを検出したら、`CGConfigureDisplayMirrorOfDisplay(display, kCGNullDirectDisplay)` を呼び出して強制的に拡張モードに戻します。失敗した場合は遅延リトライし、メインフローをブロックしません。

---

## 六、まとめ

Mac 画面を Android Pad にキャストするアーキテクチャは、一般的な「携帯画面を PC にキャスト」する方向とは逆であり、中核的な違いは Mac 側にあります：

1. **仮想ディスプレイ**：CGVirtualDisplay で独立したデスクトップ空間を作成し、CGDisplayStream でゼロコピーキャプチャ
2. **エンコードエンジン**：VideoToolbox ハードウェアエンコード、VBR + VFR でデスクトップキャストに最適化、単一 Session + レイジー再構築で異常パスをカバー
3. **Intel エンコードのフォールバック**：Apple Silicon 全シリーズの Media Engine 性能は十分であり、Intel 低スペックチップのみ動的に解像度を低下
4. **逆操作注入**：Protobuf メッセージ → ジェスチャ認識 → CGEvent によるシステム注入、タッチ/マウス/キーボード/スタイラスをカバー
