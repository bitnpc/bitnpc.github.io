---
title: 'Android スマホの画面を Mac/iPhone にミラーリングするアーキテクチャ実装'
pubDate: 2025-10-13
categories: [テクノロジー, 音声・映像]
tags:
    - 相互接続
    - 画面ミラーリング
    - ビデオコーデック
    - Metal
    - H.264
    - H.265
toc: true
description: 'Androidスマホの画面をMac/iPad/iPhoneにミラーリングするエンドツーエンドのアーキテクチャを、キャプチャ・エンコードからネットワーク伝送、デコード・レンダリング、逆方向制御まで分析する。'
---

## はじめに

スマホの画面ミラーリングはよくあるニーズである。Android スマホの画面をリアルタイムでパソコン（Mac）やタブレット（iPad/iPhone）に投射し、プレゼンテーション、リモートアシスタンス、マルチメディア共有などに利用する。低遅延で高スムーズなミラーリングを実現するには、スマホ側の画面キャプチャ・エンコードからネットワーク伝送、受信側のデコード・レンダリングに至る全チェーンをカバーする必要がある。

本稿では、Xiaomi スマートシェア（妙享桌面）の画面ミラーリングを例に、アーキテクチャの観点から **画面ミラーリング（Screen Mirroring）** と **逆方向制御（Reverse Control）** という 2 つの中核機能の実装を分析する。

## 一、全体アーキテクチャ

### エンドツーエンドのデータフロー

```
┌─ Source 端（スマホ）──────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─ プラットフォーム層（Android）─────────────────────────────────────┐    │
│  │  画面キャプチャ (MediaProjection)                                  │    │
│  │      ↓                                                            │    │
│  │  ハードウェアエンコーダ (MediaCodec)                                │    │
│  │  H.264/H.265 │ 1080p@60fps │ 8Mbps │ IDR 応答                     │    │
│  │      ↓                                                            │    │
│  │  エンコードフレームコールバック → NAL フラグメント                   │    │
│  └───────┬───────────────────────────────────────────────────────────┘    │
│          ▼                                                              │
│  ┌─ ミラーリング伝送 SDK (Source モード) ─────────────────────────────┐    │
│  │  AES 暗号化 → RTP パケット化（シーケンス番号 + timestamp）→ UDP/TCP 送信  │
│  │  ← Sink からのフィードバック受信：損失率 / IDR 要求 / ビットレート調整    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ Wi-Fi ローカルネットワーク
                                   ▼
┌─ Sink 端（Mac / iPhone / Pad）───────────────────────────────────────────┐
│  ┌─ ミラーリング伝送 SDK (Sink モード) ────────────────────────────────┐  │
│  │  UDP/TCP 受信 → RTP 再構成 → AES 復号 → メディア種別ごとにコールバック配信 │
│  │  → Source へフィードバック：損失率統計 / IDR 要求 / 推奨ビットレート      │
│  └────────────────────────────────┬────────────────┬──────────────────┘  │
│                                   │ 映像データ      │ 音声データ           │
│                                   ▼                ▼                     │
│  ┌─ プラットフォーム層（Mac/iPhone 各々実装）───────────────────────────────┐  │
│  │  VideoDecoder（VideoToolbox）→ RenderManager → Metal レンダリング     │  │
│  │  AudioDecoder（PCM/AAC）→ AudioQueue 再生                           │  │
│  │  逆方向制御：イベント収集 → 30Hz スロットル → コマンドエンコード → UDP → スマホ注入  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

データフローには 2 つのチャネルがある。**メディアチャネル**（スマホ→受信端、映像/音声）と**制御チャネル**（受信端→スマホ、タッチ操作コマンド）である。ミラーリング伝送 SDK は両端で対称的に動作する。Source 側は暗号化・パケット化・送信を担当し、Sink 側は受信・復号後に生の音声・映像データをプラットフォーム層へコールバックする。同一の SDK が「スマホ→Mac」「スマホ→iPhone」「スマホ→Pad」など様々なミラーリング組み合わせを支える。

### ミラーリング伝送 SDK

ミラーリングシステム全体の基盤は、**クロスプラットフォームミラーリング伝送 SDK**（C++ 実装、Android / macOS / iOS / Windows 共通）である。この SDK は Source と Sink の両方で動作し、接続確立、プロトコル解析、暗号化・復号、メディアデータ伝送をカプセル化し、プラグイン機構を通じて上位層にコーデックコールバックを公開する。伝送層は **RTSP + RTP** ベースで、自社開発の MPT 伝送モジュールが UDP/TCP へのフォールバックとマルチリンク切り替えをサポートする。第 3 章でその設計を詳述する。

---

## 二、Source 端：スマホでのエンコードと送信

```
┌─────────────────────────────────────────────────────────────┐
│  Android プラットフォーム層                                    │
│                                                             │
│  MediaProjection（画面キャプチャ）                            │
│       ↓ Surface                                             │
│  MediaCodec（ハードウェアエンコーダ）                           │
│       │  H.264/H.265  │  設定：解像度/フレームレート/ビットレート/Profile │
│       ↓ エンコードフレームコールバック                          │
│  NAL フラグメント処理                                         │
│       ↓                                                     │
├─────────────────────────────────────────────────────────────┤
│  ミラーリング伝送 SDK                                         │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────────┐  │
│  │ AES 暗号化 │ →  │ RTP パケット化│ →  │ UDP/TCP 送信          │  │
│  └──────────┘    └──────────┘    └───────────────────────┘  │
│       ↑                                                     │
│  ビットレート調整 / IDR 要求（Sink 側からのフィードバック）      │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 エンコードパラメータの選定

```cpp
struct EncoderConfig {
    CodecType codec = CodecType::H265;  // デフォルト H.265、旧デバイスは H.264 にフォールバック
    int width = 1920;
    int height = 1080;
    int fps = 60;
    int bitrate = 8 * 1000 * 1000;  // 8 Mbps
    int profile;
    int level;
};
```

**H.264 と H.265 の選択：**

| 比較 | H.264 | H.265 |
|------|-------|-------|
| ハードウェア互換性 | ほぼすべてのデバイス対応 | 比較的新しいデバイス対応 |
| 同等画質のビットレート | 基準 | 約 30-50% 削減 |
| エンコード遅延 | 低い | やや高い |
| デコード複雑度 | 低い | 高い |

戦略：デフォルトでは H.265 を使用し、より低いビットレートを実現する（同等画質で約 30-50% 削減）。iPad mini 4、iPad Air 2 などの旧デバイスに対してのみ H.264 へのフォールバックを強制し互換性を確保する。解像度とフレームレートはネットワーク状況に応じて動的に調整する。ネットワークが良好な場合は 1080p@60fps、ネットワークが不安定な場合は 720p@30fps にダウングレードする。

### 2.2 データパケット化と送信フロー

エンコーダが出力する圧縮フレームは以下のパイプラインでネットワークに到達する：

```
エンコーダ出力 NAL ユニット
       ↓
  NAL フラグメントとカプセル化
       ↓
  RTP パケット化（シーケンス番号 + timestamp）
       ↓
    AES 暗号化
       ↓
  ┌────┴────┐
  │ ネットワーク状態│
  └────┬────┘
 正常 ↙     ↘ 深刻なパケット損失
UDP 送信    TCP 送信
```

**NAL フラグメント：** H.264 の 1 フレームのデータが UDP の MTU（1500 バイト）を超える場合があるため、フラグメント化が必要である。受信側は RTP シーケンス番号に基づいて完全なフレームに再構成する。

**RTP プロトコル：** シーケンス番号はパケットロスの検出と並び替えに使用され、timestamp はフレームのキャプチャ時間を保持し、受信側はこれに基づいて再生タイムスタンプとジッタバッファを計算する。

**AES 暗号化：** すべての映像ペイロードを暗号化し、ミラーリングコンテンツがローカルネットワーク内で盗聴されないようにする。

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

### 2.3 エンコーダのイベントコールバック

- **キーフレーム要求（IDR Request）：** 受信側がパケットロスやデコード異常を検出した場合、スマホにキーフレームの送信を要求して画面を復元する
- **ビットレート変更通知：** ネットワーク帯域幅が変化した場合、エンコーダに目標ビットレートの調整を通知する
- **エンコード異常：** ハードウェア障害やリソース不足時の例外処理

---

## 三、ミラーリング伝送 SDK

ミラーリングシステムの最下層はクロスプラットフォームの C++ SDK であり、Android（Source）と macOS/iOS（Sink）の両方で動作する。SDK はプロトコル解析、ネットワーク伝送、暗号化・復号、セッション管理をカプセル化し、上位層に統一されたプラグインインターフェースとオプション設定を提供する。

### 3.1 両端の役割とプラグイン機構

SDK は Server-Client モデルを採用し、両端のインターフェースは対称的だが責務は異なる：

```
┌─ Source 端 ─────────────────────────────┐  ┌─ Sink 端 ───────────────────────────────┐
│                                          │  │                                          │
│  IMiPlayCastMirrorServer (C++ インターフェース) │  │  IMiPlayCastMirrorClient (C++ インターフェース) │
│                                          │  │                                          │
│  • attachSurface(surface)  キャプチャ Surface をバインド│  │  • attachSurface(surface) レンダリング Surface をバインド│
│  • setAttribute(type, val) エンコードパラメータ設定     │  │  • setAttribute(type, val) デコードパラメータ設定     │
│  • registerVideoPlugin(p)  エンコードコールバック登録   │  │  • registerVideoPlugin(p) デコードコールバック登録   │
│  • registerAudioPlugin(p)  音声コールバック登録      │  │  • registerAudioPlugin(p) 音声コールバック登録      │
│  • registerStateCallback() 状態コールバック登録      │  │  • registerStateCallback() 状態コールバック登録     │
│  • write(type, data, len, pts) エンコードフレーム送信 │  │  • start(uri) / stop() セッション制御               │
│  • start(uri) / stop() セッション制御              │  │  • pause(mediaType) / resume() メディア制御       │
│                                          │  │                                          │
└──────────────────────────────────────────┘  └──────────────────────────────────────────┘
```

SDK は**プラグインインターフェース**を通じて上位層のデコード・レンダリングロジックと疎結合になっている。上位層は `MediaPlugin` インターフェースを実装し登録するだけでよい：

```cpp
class MediaPlugin {
public:
    virtual int32_t onInit(MediaAttribute attr) = 0;  // ネゴシエーション後のメディアパラメータを渡す
    virtual int32_t onStart() = 0;
    virtual int32_t onStop() = 0;
    virtual int32_t onPause() = 0;
    virtual int32_t onResume() = 0;
    virtual int32_t onChangeMediaAttribute(int32_t type, MediaAttribute attr) = 0;
};
```

コーデックパラメータは `setAttribute()` でプリセットされ、SDK は接続確立後に相手側とネゴシエーションし、その結果を `onInit()` の `MediaAttribute` 構造体でプラグインにコールバックする：

```cpp
struct MediaAttribute {
    int32_t width;        // 映像幅
    int32_t height;       // 映像高
    int32_t fps;          // フレームレート
    int8_t  format[50];   // コーデックフォーマット文字列 (video/avc 等)
    int32_t profile;      // Profile
    int32_t level;        // Level
    int32_t bitrate;      // ビットレート (bps)
    int32_t channels;     // 音声チャンネル数
    int32_t sampleBits;   // 音声サンプルビット数
    int32_t sampleRate;   // 音声サンプルレート
};
```

### 3.2 状態コールバックとセッションライフサイクル

SDK は `StateCallback` インターフェースを通じて接続状態とデータ到着を外部に通知する：

```cpp
class StateCallback {
public:
    virtual void onStarted(int32_t localPort) = 0;           // Server 側起動成功
    virtual void onConnected() = 0;                          // 接続確立
    virtual void onDisconnected() = 0;                       // 接続切断
    virtual void onPlayed(int32_t status) = 0;               // メディア再生開始
    virtual void onError(int32_t what, int32_t extra) = 0;   // エラー
    virtual void onInfo(int32_t what, int64_t extra) = 0;    // 情報通知
    virtual int32_t onReceiveData(int32_t mediaType,         // メディアデータ受信
                                   int8_t* data, int32_t len, int64_t pts) = 0;
};
```

1 回の完全なミラーリングセッションは接続から再生まで：

```
Server.start(uri)                                        Client.start(uri)
       │                                                       │
       ▼                                                       ▼
  接続確立 ─────────── TCP ハンドシェイク / RTSP シグナリング ─────→ 接続確立
       │                                                       │
       ▼                                                       ▼
onStarted(localPort)                                   onConnected()
       │                                                       │
       ▼                                                       ▼
 暗号化ネゴシエーション ──────── AES key/iv 交換 ──────────────→ 暗号化ネゴシエーション
       │                                                       │
       ▼                                                       ▼
registerMediaPlugin()                                 registerMediaPlugin()
       │                                                       │
       ▼                                                       ▼
  start データストリーム ───── RTP over UDP ────────────────→ onReceiveData()
       │                                                     → plugin.onInit(attr)
       │                                                     → plugin.onStart()
       ▼                                                       ▼
onPlayed(0)                                           onPlayed(0)
```

### 3.3 伝送プロトコル

SDK は **RTSP + RTP** プロトコルスタックをベースとし、標準の RTP 層の上に拡張を施している：

```
アプリケーションデータ層：エンコード後の H.264/H.265 映像フレーム / PCM/AAC 音声フレーム
     ↓
RTP カプセル化層：シーケンス番号 + timestamp + ペイロードタイプ識別子
     ↓
カスタム伝送層 (MPT)：UDP 優先、TCP フォールバックと天琴チャネルをサポート
     ↓
物理リンク：Wi-Fi / P2P / Bluetooth
```

RTP シーケンス番号はパケットロス検出と順序再整列に使用され、timestamp はフレームをキャプチャのタイムラインに復元する。これが Jitter Buffer の基盤である。

**天琴チャネル（Lyra Channel）：** SDK は「天琴」リンクを経由した伝送もサポートする。スマホと受信端は Bluetooth、アドホック WLAN、またはリモート転送チャネルを介して RTP/RTSP データを交換できるため、同じローカルネットワークにいる必要はない。`Option_UseLyraChannel` により使用する下位リンクを制御する。この仕組みにより、ミラーリングの利用シナリオがさらに拡張される。

### 3.4 パラメータネゴシエーションとビットレート適応

エンコードパラメータは片側だけで決定されるわけではない。`setAttribute()` でプリセットした後、SDK が接続確立フェーズで相手側とネゴシエーションする：

```
Source 端 setAttribute()                  Sink 端 setAttribute()
  VideoWidth  = 1920                       VideoWidth  = 1920
  VideoFps    = 60                         VideoFps    = 60
  VideoEncType = H265                      VideoEncType = H264  ← Sink 側は H.264 を優先
  VideoBitrate = 8M
       │                                        │
       └──────── ネゴシエーション結果 ────────────┘
                     VideoEncType = H264  (積集合、Sink が非対応のため H.264 にフォールバック)
                     その他のパラメータは最小値を採用
                     → onInit(attr) で上位層に通知
```

SDK にはビットレート適応機能（`Option_EnableAdptiveFun`）が組み込まれており、実行時に RTP パケットロス率のフィードバックに基づいてエンコードビットレートを動的に調整する。上位層がコアロジックに関与する必要はなく、`onInfo()` を通じて調整イベントを把握するだけでよい。

### 3.5 暗号化体系

SDK の暗号化は階層化されている：

| 層 | 設定項目 | 説明 |
|----|----------|------|
| 暗号化タイプ | `ENCRYPTION_TYPE_AES` / `SMS4` | 暗号化アルゴリズムの選択 |
| 暗号化レベル | `AESCBC128` / `192` / `256` | AES 鍵長 |
| 暗号化範囲 | `FORMAT_VIDEO` / `AUDIO` / `CMD` | 映像のみ、音声のみ、または制御コマンドのみの暗号化が可能 |
| 伝送暗号化 | `ENCRYPTION_TRANSLEVEL_XOR` | 鍵伝送時の追加 XOR 保護 |
| 完全性 | `SHA256` / `SHA128` / `MD5` | データ完全性検証 |

暗号化鍵（`key` + `iv`）と認証鍵（`authKey`）は上位層が `start()` の前に `setAttribute()` で注入する。暗号化・復号は SDK 内部で透過的に行われ、上位層が受け取る音声・映像データは復号済みの平文である。

---

## 四、Sink 端：受信、デコードとレンダリング

Sink 端はシステム全体で最も複雑な部分である。内部アーキテクチャ：

```
┌─ SDK プロトコル層 ──────────────────────────────────────────────┐
│  UDP/TCP 受信 → AES 復号 → RTP 再構成 → メディア種別配信        │
└────────────────────────────┬─────────────┬────────────────────┘
                             │ 映像        │ 音声
┌─ コーデックエンジン層 ─────▼─────────────▼────────────────────┐
│                                                               │
│  VideoDecoder (VideoToolbox)   AudioDecoder (PCM/AAC)            │
│       ↓                          ↓                            │
│  RenderManager                AudioPlayer                     │
│  (Jitter Buffer/フレームスケジューリング) (AudioQueue リングバッファ) │
│       ↓                                                       │
├───────┼───────────────────────────────────────────────────────┤
│       ↓              UI レンダリング層                         │
│  MetalRenderView（YUV→RGB / ゼロコピー）                       │
└───────────────────────────────────────────────────────────────┘
```

### 4.1 SDK プロトコル層

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

プロトコル層はコールバックパターンでデータを配信する。映像データを受信すると `VideoPlugin::write()` を呼び出し、音声データを受信すると `AudioPlugin::write()` を呼び出し、接続状態の変化は `StateCallback` で報告する。

SDK には第一段階の Jitter Buffer（設定 `JitterBufferSetEnable = 1`、バッファしきい値 `BufferingThreshold = 200ms`）が組み込まれており、ネットワーク受信層でのジッタを吸収する。エンジン層にコールバックされるフレームはすでに PTS 順に並び替えられている。エンジン層の `RenderManager` は第二段階の Jitter Buffer であり、デコード済みフレームのレンダリングタイミングを制御する。

### 4.2 ビデオデコードエンジン

ビデオデコーダは VideoToolbox ハードウェアアクセラレーションをベースとし、FFmpeg ソフトウェアデコードをフォールバックとして用意する：

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
        // ビットストリームの SPS/PPS から CMVideoFormatDescription を構築
        CMVideoFormatDescriptionCreateFromH264ParameterSets(
            nullptr, paramCount, paramPointers, paramSizes, 4,
            &formatDescription_);

        // VTDecompressionSession を作成
        VTDecompressionOutputCallbackRecord callback{&onFrameDecoded, this};
        return VTDecompressionSessionCreate(
            nullptr, formatDescription_, decoderSpec,
            destImageBufferAttributes, &callback, &session_);
    }

    int decode(const uint8_t* data, size_t size, int64_t pts) {
        // Annex-B startcode → AVCC 長さプレフィックス形式変換
        auto avccData = convertAnnexBToAVCC(data, size);

        // CMSampleBuffer を構築してデコードを投入
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

デコーダは初期化時にビットストリームの SPS/PPS から `CMVideoFormatDescription` を構築し、`VTDecompressionSession` を作成する。受信したエンコードデータは **Annex-B → AVCC 形式変換**（`0x00000001` 開始コードを 4 バイト長さプレフィックスに置換）を行い、`CMSampleBuffer` にカプセル化して VideoToolbox に非同期デコードとして投入する。デコード完了した `CVPixelBuffer` はコールバックを通じて `RenderManager` にプッシュされ、レンダリングスケジューリングを待つ。

デコードパイプラインのコアコードパス：

```
デコードスレッド receiveLoop():
    ├─ put(AVPacket) → デコード待ちキューへ
    ├─ decodeLoop(): キューからパケットを取り出す
    │   └─ NativeVTDecoder.decode() → VTDecompressionSessionDecodeFrame()
    └─ onFrameDecoded() コールバック → RenderManager.addFrame()
```

デコードスレッドは独立して動作し、レンダリングスレッドとはフレームキューを通じて疎結合されている（詳細は[トラブルシュート記録](#その他の典型的な問題)を参照）。

### 4.3 フレームスケジューリングとレンダリング管理

フレームスケジューラは**遅延と滑らかさのバランス**を制御する中核である：

```cpp
class RenderManager {
public:
    void addFrame(int64_t index, int64_t pts);
    int64_t render();  // 次回レンダリングまでの待機時間を返す（μs）
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
    int64_t recommendMinus_{0};        // 推奨レンダリング先行時間
    int64_t vsyncInterval_{16000};     // V-Sync 間隔（μs, ~60fps）
    int64_t maxRenderDelayUs_{70000};  // 最大許容レンダリング遅延
    int maxRenderCache_{0};
};
```

**コアスケジューリングロジック：**

```cpp
int64_t RenderManager::render() {
    if (pendingFrames_.empty()) return emptyWaitTime_;

    auto& frame = pendingFrames_.front();
    int64_t now = currentTimeMicros();
    int64_t targetTime = frame.pts + recommendMinus_;

    // キュー蓄積：古いフレームを破棄し、最新のみ保持
    if (maxRenderCache_ > 0 && pendingFrames_.size() > maxRenderCache_) {
        while (pendingFrames_.size() > 1) {
            pendingFrames_.pop_front();
            dropCount_++;
        }
    }

    // フレームが古すぎる：破棄
    if (now - targetTime > maxRenderDelayUs_) {
        pendingFrames_.pop_front();
        dropCount_++;
        return 0;  // 直ちに次のフレームをチェック
    }

    // レンダリング時刻に達していない：待機
    if (now < targetTime) return targetTime - now;

    // レンダリング
    pendingFrames_.pop_front();
    renderCallback_(frame.pts, now, false);
    return vsyncInterval_;
}
```

**重要な設計判断：**

- **フレームドロップ戦略**：キューが蓄積した場合、古いフレームを優先的に破棄し新しいフレームを保持する。ミラーリング表示は「現在の画面」を表示することが目的であり、「滑らかな再生」ではない
- **2段階 Jitter Buffer**：SDK 層で第一段階のバッファリング（200ms しきい値、ネットワークジッタを吸収しフレームを再整列）を行い、エンジン層で第二段階の制御（レンダリング進捗に応じて動的に調整）を行う。ジッタが大きいときはバッファを増やし（遅延と引き換えに滑らかさを確保）、ジッタが小さいときはバッファを減らす（遅延を低減）
- **V-Sync 同期**：レンダリングタイミングを画面リフレッシュ信号に合わせ、ティアリングを低減

### 4.4 Metal ハードウェアレンダリング

デコーダ出力の `CVPixelBuffer` を画面に表示するには、Apple プラットフォームでは 2 つの方法がある。`AVSampleBufferDisplayLayer`（システム管理のレンダリング）を使用するか、Metal で自前のレンダリングを制御するかである。

| 観点 | Metal 自前レンダリング | AVSampleBufferDisplayLayer |
|------|-----------------------|---------------------------|
| レンダリングタイミング | 完全自前制御（VSync に合わせる） | システム内部バッファキュー、遅延制御不可 |
| フレームドロップ戦略 | カスタム（古いフレームを破棄し新しいものを保持） | システム決定、介入不可 |
| 色空間 | 独自の YUV→RGB shader 記述 | システム自動処理 |
| コード複雑度 | 高い | 低い（数行の enqueue コード） |

ミラーリングは遅延に敏感なシナリオであり、中核要件は**「いつ、どのフレームをレンダリングするか」を自ら決定できること**である。ネットワークジッタでフレームが蓄積した場合、古いフレームを破棄して最新の画面のみを表示する必要がある。これは `AVSampleBufferDisplayLayer` では実現できない（PTS 順に平滑再生するため、動画プレイヤーには適しているが、リアルタイムミラーリングには適さない）。そのため Metal による自前レンダリングを選択する。

Metal レンダリングビューは `CVMetalTextureCache` を使用してゼロコピーでの画面表示を実現する：

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

        // CVMetalTextureCache：ゼロコピーの鍵
        CVMetalTextureCacheCreate(kCFAllocatorDefault, nil, device, nil, &textureCache)

        setupRenderPipeline()
    }

    func render(pixelBuffer: CVPixelBuffer) {
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)

        // Y プレーンテクスチャ（ゼロコピー：IOSurface を直接マッピング）
        var texY: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(
            kCFAllocatorDefault, textureCache,
            pixelBuffer, nil, .r8Unorm, width, height, 0, &texY)

        // UV プレーンテクスチャ
        var texUV: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(
            kCFAllocatorDefault, textureCache,
            pixelBuffer, nil, .rg8Unorm, width / 2, height / 2, 1, &texUV)

        guard let mtlY = CVMetalTextureGetTexture(texY!),
              let mtlUV = CVMetalTextureGetTexture(texUV!) else { return }

        // GPU 描画コマンドを投入
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

    // BT.709 色空間変換
    float y_adj = y - 0.0625;
    float u = uv.x - 0.5;
    float v = uv.y - 0.5;

    float r = y_adj + 1.5748 * v;
    float g = y_adj - 0.1873 * u - 0.4681 * v;
    float b = y_adj + 1.8556 * u;

    return float4(r, g, b, 1.0);
}
```

### 4.5 音声同期

音声パスはデフォルトで PCM コーデックを使用する（低遅延、圧縮解除不要）。フォールバックとして AAC もサポートする：

```cpp
class AudioDecoder {
public:
    int write(const uint8_t* data, size_t size, int64_t pts);
    int readPCM(uint8_t* buffer, size_t size, int64_t* pts);

private:
    PCMDecoder pcmDecoder_;   // PCM パススルー（デフォルト）
    AACDecoder aacDecoder_;   // FFmpeg AAC → PCM（フォールバック）
};
```

Source 側はデフォルトで PCM データ（サンプルレート 48000Hz、ステレオ、16bit）を送信し、受信側はそのまま AudioQueue に渡す。相手側が PCM に対応していない場合は、AAC エンコードにフォールバックする。FFmpeg の `avcodec_decode_audio4` でデコードした後、PCM に変換して再生する。

**AudioQueue リングバッファ：** 5 つのバッファからなるリング構造を使用し、AudioQueue システムコールバックがデータを要求する際にリングバッファからデータを充填する：

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

**音声・映像同期：** 音声クロックをマスタークロックとし、映像フレームのレンダリングは音声再生の進行に追従する。

---

## 五、逆方向制御の実装

逆方向制御は、ユーザーが Mac/iPhone 上でマウスやタッチスクリーンを使ってスマホを直接操作できるようにするものであり、映像ストリームとは独立したチャネルである。

### 5.1 アーキテクチャ

```
    Sink 端（Mac/iPhone）              ネットワーク                Source 端（スマホ）
┌───────────────────────┐    ┌──────────────┐    ┌─────────────────────┐
│ マウス/タッチイベント収集  │    │              │    │ コマンド解析         │
│       ↓               │    │  独立 UDP    │    │    ↓                │
│ 座標正規化            │ ──►│  チャネル    │──► │ 座標マッピング       │
│       ↓               │    │ (HID コマンド)│    │    ↓                │
│ 30Hz スロットル→シリアル化│    │              │    │ Android 入力システム注入│
└───────────────────────┘    └──────────────┘    └─────────────────────┘
```

### 5.2 イベント収集とコマンドエンコード

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
    let x: Float         // 正規化座標 (0.0 - 1.0)
    let y: Float
    let pressure: Float
    let timestamp: UInt64
}
```

macOS 側のイベント収集：

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

### 5.3 コマンド送信

制御コマンドは映像ストリームとは別の独立した UDP チャネルを使用する：

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

### 5.4 スマホ側の応答

```cpp
void onCommandReceived(const uint8_t* data, size_t size) {
    auto cmd = deserialize(data, size);

    // 正規化座標 → スマホの実際のピクセル座標
    int screenX = static_cast<int>(cmd.x * deviceWidth_);
    int screenY = static_cast<int>(cmd.y * deviceHeight_);

    switch (cmd.action) {
    case TOUCH_DOWN: injectTouchEvent(ACTION_DOWN, screenX, screenY); break;
    case TOUCH_MOVE: injectTouchEvent(ACTION_MOVE, screenX, screenY); break;
    case TOUCH_UP:   injectTouchEvent(ACTION_UP, screenX, screenY);   break;
    }
}
```

### 5.5 遅延感応性

| タイプ | 許容遅延 | 影響 |
|-------|---------|------|
| 映像フレーム | 100-300ms | 見た目は悪化するが許容可能 |
| 制御コマンド | < 50ms | ユーザーが「追従しない」と感じる |
| 連続スワイプ | < 33ms | 軌跡が断絶した感覚 |

制御チャネルの設計原則：独立した UDP チャネル、コマンドの優先度は映像フレームより高い、データサイズは極小（単一パケットで到達可能）。

---

## 六、トラブルシュート記録

### Metal レンダリングの画面破損（Intel Mac）

**現象：** Intel Mac でランダムに画面が破損・緑色になる。M チップ搭載機種では全く問題なし。再現のタイミングが不確定で、調査が困難。

**調査過程：** 当初は FFmpeg のデコード出力異常を疑った。そのため FFmpeg をバイパスして直接 `VTDecompressionSession` でデコードし比較したが、画面破損は変わらず。さらにデコード後の映像フレームをローカルファイルに書き出して再生すると、映像は完全に正常だった。これでデコード層の疑いは完全に晴れた。次に、同じデコード出力を `AVSampleBufferDisplayLayer` でレンダリングしてみると、画面破損は解消された。これで問題が Metal レンダリング層にあることが確定した。最終的に、旧実装ではフレームごとに `CVMetalTextureCache` を新規作成し、レンダリング後に即座に破棄していたことが原因と特定された。

`CVMetalTextureCache` の正しい使い方は一度作成して継続的に再利用することである（Apple のドキュメントで明示的に推奨）。フレームごとに再構築するのはベストプラクティスに反するが、Intel GPU の個別ビデオメモリアーキテクチャでのみ GPU リソースの競合が発生する（GPU がテクスチャを参照している最中に CPU 側が解放してしまう）。M チップのユニファイドメモリアーキテクチャはこれに対する耐性が高く、問題が表面化しなかった。

修正自体は複雑ではない。`TextureCache` をビューのライフサイクルに合わせて保持し、インフライトフレーム数を制御して GPU の蓄積を防止する。しかし、得られた教訓は記録に値する。**M チップ Mac で正常に動作するからといって Intel Mac でも正常に動作するとは限らない**。両方のアーキテクチャを十分にカバーしたテストが必須である。

### 逆方向制御タッチサンプリングレートのスロットル

**現象：** Mac 端でのドラッグ操作時、スマホ側で明らかな操作遅延とカクつきが発生する。映像の滑らかさとは無関係である。

**分析：**

各デバイスのタッチ・ジェスチャーサンプリングレート：

| デバイス | タッチサンプリングレート | 説明 |
|---------|----------------------|------|
| Mac トラックパッド / マウス | ~60-80 Hz | macOS はディスプレイリフレッシュレートに合わせてイベントを配信 |
| iPhone（標準） | ~60-120 Hz | |
| iPhone Pro | ~120 Hz | ProMotion デバイス |
| iPad Pro | **240 Hz** | Apple Pencil の低遅延に対応 |

Mac のトラックパッドは約 70Hz で `mouseDragged` イベントを生成する。これをすべてスマホ側に転送すると、Android の `InputDispatcher` は vsync（60Hz）のリズムでイベントを消費するため、余分なイベントは次の vsync まで待機することになり、累積的に遅延が増大する。

**解決策：** Sink 側でタッチイベントに **30Hz のスロットル** を適用する：

```swift
class EventThrottler {
    private let interval: TimeInterval = 1.0 / 30.0  // 33ms
    private var lastSendTime: TimeInterval = 0
    private var pendingCommand: ControlCommand?

    func submit(_ command: ControlCommand) {
        let now = CACurrentMediaTime()

        // touchDown / touchUp は即時送信、スロットルしない
        if command.action == .touchDown || command.action == .touchUp {
            send(command)
            lastSendTime = now
            return
        }

        // touchMove はスロットル
        if now - lastSendTime >= interval {
            send(command)
            lastSendTime = now
        } else {
            pendingCommand = command  // 最新の位置を保持し、次回送信
        }
    }
}
```

**なぜ 30Hz なのか：**
- 30Hz は 2 vsync 周期（16.6ms × 2 = 33ms）あたり最大 1 イベントとなり、蓄積が発生しない
- 人間の目がタッチ軌跡の連続性を知覚するしきい値は約 20-30Hz であり、30Hz のドラッグ軌跡でも滑らかに感じられる
- `touchDown` と `touchUp` はスロットルせず、クリック応答の即時性を確保する

### その他の典型的な問題

**解像度の動的变化によるハードウェアデコードのクラッシュ：** スマホの縦横切り替え時に、ビットストリームの幅・高さが急変する。VideoToolbox の `VTDecompressionSession` は動的な解像度変更をサポートしていない。SPS 中の幅・高さの変化を検出したら、古い Session を破棄し新しいパラメータで再構築する必要がある。未処理の場合、`kVTInvalidSessionErr` が発生して直接クラッシュする。

**音声バッファオーバーフロー：** AAC デコード後の PCM データサイズはサンプルレート変換比率（例：44100→48000）に依存するため、固定値をハードコーディングできない。修正：入力サンプルレートと出力サンプルレートから動的にバッファサイズを計算し、同時に PCM buffer のライフサイクルを AudioPlayer で一元管理して double-free を回避する。

**PTS 重複によるフレーム順序異常：** エンコード側で稀に同一 PTS のフレームが生成されることがある（B フレーム参照やエンコーダのバグ）。そのためレンダリングキューの PTS ソートロジックが機能しなくなる。修正：インクリメンタルな `frameIndex` を副次的なソートキーとして導入する。同一 PTS の場合は到着順にレンダリングし、決定性を保証する。

---

## 七、業界ソリューションとの比較

| 観点 | 本方式 | Scrcpy | AirPlay | Google Cast |
|------|--------|--------|---------|-------------|
| 伝送プロトコル | RTSP/RTP + 自社 MPT（UDP/TCP/マルチリンク） | ADB Tunnel（USB/Wi-Fi） | RTSP/RTP + UDP | WebRTC |
| 暗号化 | AES | なし | FairPlay DRM | DTLS-SRTP |
| ビデオデコード | VideoToolbox ハードウェアデコード | FFmpeg ソフトウェアデコード | VideoToolbox ハードウェアデコード | ハードウェアデコード |
| 音声コーデック | PCM / AAC | PCM / Opus | ALAC / AAC | Opus |
| 逆方向制御 | 独立 UDP + HID コマンド | ADB HID イベント注入 | MFI プロトコル | WebRTC DataChannel |
| 遅延 | 30-100ms（ローカルネットワーク） | 30-70ms（有線） | 50-200ms | 50-300ms+ |
| クロスプラットフォーム Sink | macOS + iOS | 全デスクトッププラットフォーム | Apple エコシステム | 全プラットフォーム |
| オープンソース | 自社開発 | ✅ オープンソース | 一部オープンソース | 一部オープンソース |

各方式の適用シナリオ：

- **Scrcpy**：開発者が Android アプリをデバッグする際の第一選択ツール。遅延は極めて低いが ADB に依存し、暗号化がないため日常的な非開発用途には適さない
- **AirPlay**：Apple エコシステム内では最適。エンドツーエンドの遅延が低く統合性も高いが、閉じたエコシステムのため Android → iPhone 方向には制限がある
- **Google Cast**：クロスプラットフォーム能力が最も強い（WebRTC）。インターネット経由のミラーリングに適するが、遅延が高い（クラウドシグナリングに強く依存）
- **本方式**：各方式の長所を取り入れている。伝送層の自社プロトコルは AirPlay に近い遅延レベルを実現し、制御チャネルは Scrcpy の逆方向制御アプローチを参考にし、Sink 端は macOS/iOS の 2 大 Apple プラットフォームをカバーする

---

## 八、まとめ

本稿では、Android スマホの画面を Mac/iPhone にミラーリングするエンドツーエンドのアーキテクチャを分析した：

1. **Source 端**：Android プラットフォーム層（キャプチャ + MediaCodec エンコード）+ ミラーリング伝送 SDK（暗号化 + RTP + 送信）

2. **Sink 端の3層構造**：ミラーリング伝送 SDK（受信/復号）→ コーデックエンジン（VideoToolbox ハードウェアデコード + フレームスケジューリング）→ UI レンダリング層（Metal）。SDK とエンジン層は C++ でクロスプラットフォーム、レンダリング層は各プラットフォームで個別実装

3. **ネットワーク伝送**：RTSP + RTP ベース、自社開発 MPT 伝送モジュールが UDP/TCP/天琴マルチリンクをサポート

4. **逆方向制御**：独立した UDP チャネル + 30Hz スロットル + 座標正規化マッピング

5. **クロスアーキテクチャ互換性**：M チップのユニファイドメモリは GPU リソースのライフサイクル問題を隠蔽する可能性があるため、Intel Mac でも十分にカバーしたテストが必要である
