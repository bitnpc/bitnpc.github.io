---
title: 'FFmpeg 入門'
pubDate: 2022-05-25
categories: [テクノロジー, 音声・映像]
tags:
    - FFmpeg
    - 音声・映像
toc: true
description: 'FFmpeg は、音声・映像のコーデックツールであると同時に、一連の音声・映像コーデック開発キットでもあります。オープンソースのマルチメディア処理における事実上の標準であり、ほぼ全ての動画プレイヤー、ストリーミングサービス、動画編集ソフトウェアの背後で FFmpeg が利用されています。'
---

## FFmpeg の定義

`FFmpeg` は、音声・映像のコーデックツールであると同時に、一連の音声・映像コーデック開発キットでもあります。オープンソースのマルチメディア処理における事実上の標準であり、ほぼ全ての動画プレイヤー、ストリーミングサービス、動画編集ソフトウェアの背後で FFmpeg が利用されています。

`FFmpeg` は多様なプロトコルをサポートし、多数のマルチメディアフォーマットにおけるカプセル化とデカプセル化、音声・映像のエンコードおよびデコード、サンプリングレート変換、ビットレート変換、カラーフォーマット変換など、豊富な機能を提供します。

名称の意味：
- **FF**：Fast Forward（早送り）
- **mpeg**：Moving Picture Experts Group（動画像専門家グループ）

### 音声・映像の基礎概念

FFmpeg を理解する前に、音声・映像処理の流れにおけるいくつかの核となる概念を明確にしておく必要があります。

| 概念 | 説明 | 例 |
|------|------|------|
| プロトコル（Protocol） | データ転送の方式 | HLS、RTSP、RTMP、SRT |
| コンテナフォーマット（Container） | 音声・映像のエンコードストリームをファイルにまとめる形式 | MP4、MKV、FLV、MOV、AVI |
| コーデック（Codec） | 音声・映像データを圧縮するアルゴリズム | H.264、H.265、VP9、AV1（映像）；AAC、Opus、MP3（音声） |

動画ファイルの階層構造：

```
┌─────────────────────────────────────┐
│         Container (例: MP4)          │
│  ┌───────────────────────────────┐  │
│  │  Video Stream (例: H.264)     │  │
│  ├───────────────────────────────┤  │
│  │  Audio Stream (例: AAC)       │  │
│  ├───────────────────────────────┤  │
│  │  Subtitle Stream (例: SRT)    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

1つのカプセル化ファイルには、複数の音声・映像ストリーム（多言語の音声トラック、複数の字幕トラックなど）を含めることができます。

---

## FFmpeg のインストールと使用方法

`macOS` プラットフォームでは、`homebrew` を使用して `ffmpeg` の実行可能ファイルをインストールできます。

```bash
$ brew install ffmpeg

$ ffmpeg -version
ffmpeg version 5.1.2 Copyright (c) 2000-2022 the FFmpeg developers
built with Apple clang version 14.0.0 (clang-1400.0.29.202)
configuration: --prefix=/opt/homebrew/Cellar/ffmpeg/5.1.2_6 --enable-shared --enable-pthreads --enable-version3 --cc=clang --host-cflags= --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libaribb24 --enable-libbluray --enable-libdav1d --enable-libmp3lame --enable-libopus --enable-librav1e --enable-librist --enable-librubberband --enable-libsnappy --enable-libsrt --enable-libsvtav1 --enable-libtesseract --enable-libtheora --enable-libvidstab --enable-libvmaf --enable-libvorbis --enable-libvpx --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxml2 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-libspeex --enable-libsoxr --enable-libzmq --enable-libzimg --disable-libjack --disable-indev=jack --enable-videotoolbox --enable-neon
libavutil      57. 28.100 / 57. 28.100
libavcodec     59. 37.100 / 59. 37.100
libavformat    59. 27.100 / 59. 27.100
libavdevice    59.  7.100 / 59.  7.100
libavfilter     8. 44.100 /  8. 44.100
libswscale      6.  7.100 /  6.  7.100
libswresample   4.  7.100 /  4.  7.100
libpostproc    56.  6.100 / 56.  6.100
```

### コマンド構文

FFmpeg のコマンドライン構文は以下の形式に従います。

```
ffmpeg [global_options] {[input_file_options] -i input_url} ... {[output_file_options] output_url} ...
```

重要なルール：
- **オプションは直後のファイルに適用される**：`-i` の前に書かれたオプションは入力ファイルに、出力ファイルの前に書かれたオプションは出力ファイルに適用されます
- **順序に依存**：すべての入力は出力より前に指定しなければなりません
- **グローバルオプション**は先頭に配置します。例：`-y`（出力ファイルの上書き）、`-n`（上書きしない）、`-v`（ログレベル）

例：
```bash
# -ss を -i の前：入力オプションとして、キーフレーム単位でシーク（高速だが不正確）
$ ffmpeg -ss 30 -i input.mp4 -c copy output.mp4

# -ss を -i の後：出力オプションとして、フレーム単位でシーク（正確だが低速）
$ ffmpeg -i input.mp4 -ss 30 -c copy output.mp4
```

### 簡単なトランスコードの例

```bash
$ ffmpeg -i input.mp4 output.avi
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    encoder         : Lavf58.76.100
  Duration: 00:00:07.62, start: 0.000000, bitrate: 13805 kb/s
  Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709), 1920x1080, 13679 kb/s, 29.97 fps, 29.97 tbr, 30k tbn, 59.94 tbc (default)
    Metadata:
      handler_name    : Core Media Video
      vendor_id       : [0][0][0][0]
  Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 130 kb/s (default)
    Metadata:
      handler_name    : Core Media Audio
      vendor_id       : [0][0][0][0]
Stream mapping:
  Stream #0:0 -> #0:0 (h264 (native) -> mpeg4 (native))
  Stream #0:1 -> #0:1 (aac (native) -> mp3 (libmp3lame))
Press [q] to stop, [?] for help
Output #0, avi, to 'output.avi':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    ISFT            : Lavf58.76.100
  Stream #0:0(und): Video: mpeg4 (FMP4 / 0x34504D46), yuv420p(tv, bt709, progressive), 1920x1080, q=2-31, 200 kb/s, 29.97 fps, 29.97 tbn (default)
    Metadata:
      handler_name    : Core Media Video
      vendor_id       : [0][0][0][0]
      encoder         : Lavc58.134.100 mpeg4
    Side data:
      cpb: bitrate max/min/avg: 0/0/200000 buffer size: 0 vbv_delay: N/A
  Stream #0:1(und): Audio: mp3 (U[0][0][0] / 0x0055), 44100 Hz, stereo, fltp (default)
    Metadata:
      handler_name    : Core Media Audio
      vendor_id       : [0][0][0][0]
      encoder         : Lavc58.134.100 libmp3lame
frame=  228 fps=202 q=31.0 Lsize=    5363kB time=00:00:07.60 bitrate=5775.1kbits/s speed=6.74x
video:5221kB audio:120kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: 0.412835%
```

このコマンドは、`-i` パラメータで `input.mp4` を入力ソースとして指定し、トランスコードとトランスマルチプレクシング（再カプセル化）を実行し、最後に `output.avi` ファイルに出力しています。

出力から確認できること：
- **入力**：カプセル化形式 `mp4`、映像コーデック `H.264`、音声コーデック `AAC`
- **出力**：カプセル化形式 `avi`、映像コーデック `mpeg4`、音声コーデック `MP3`
- **Stream mapping** にトランスコードの経路が明確に表示されています

### FFmpeg の処理フロー

FFmpeg の核となる処理フローは以下の図の通りです。

```
 _______              ______________
|       |            |              |
| input |  demuxer   | encoded data |   decoder
| file  | ---------> | packets      | -----+
|_______|            |______________|      |
                                           v
                                       _________
                                      |         |
                                      | decoded |
                                      | frames  |
                                      |_________|
 ________             ______________       |
|        |           |              |      |
| output | <-------- | encoded data | <----+
| file   |   muxer   | packets      |   encoder
|________|           |______________|

```

処理手順：
1. **Demux（デカプセル化）**：コンテナから音声、映像などの各圧縮データパケット（packets）を分離します
2. **Decode（デコード）**：圧縮されたデータパケットを生のフレーム（frames）にデコードします —— 映像は YUV/RGB ピクセルデータ、音声は PCM サンプルデータになります
3. **Filter（フィルタ処理、オプション）**：生のフレームに対して拡大・縮小、切り抜き、透かし追加、色調整などの処理を行います
4. **Encode（エンコード）**：処理後の生のフレームを再圧縮してエンコードします
5. **Mux（カプセル化）**：エンコードされたデータパケットを目的のコンテナ形式にまとめます
```alert
type: success
description: コーデック形式を変更せずにコンテナ形式のみを変換する場合（例：mp4 → mkv）、`-c copy` を使用することでデコードとエンコードの手順をスキップでき、非常に高速で画質劣化もありません。
```

### Stream Copy（ストリームコピー）

Stream copy は FFmpeg が提供する特別なモードで、`-c copy` または `-codec copy` で有効になります。このモードでは、FFmpeg はデータのデコードや再エンコードを行わず、demux 後の圧縮データパケットをそのまま出力コンテナに再カプセル化します。

```
 _______              ______________            ________
|       |            |              |          |        |
| input |  demuxer   | encoded data |  muxer   | output |
| file  | ---------> | packets      | -------> | file   |
|_______|            |______________|          |________|
```

特徴：
- 非常に高速（エンコード・デコードの演算が不要）
- 画質劣化なし（データが変更されない）
- フィルタは適用不可（フィルタはデコード後の生フレームにのみ処理可能）
- タイムスタンプや互換性の問題が発生する可能性あり（ソースとターゲットのフォーマット制約の違いによる）

### Stream Specifier（ストリーム指定子）

一部のオプションは特定のストリームに対して適用されるため、stream specifier を使用して対象を指定する必要があります。構文はオプションの後に `:stream_specifier` を付加します。

```bash
# 構文形式
-option[:stream_specifier] value
```

よく使われる stream specifier：

| 指定子 | 意味 | 例 |
|--------|------|------|
| `:v` | 映像ストリーム | `-c:v libx264` 映像コーデックを指定 |
| `:a` | 音声ストリーム | `-c:a aac` 音声コーデックを指定 |
| `:s` | 字幕ストリーム | `-c:s mov_text` 字幕コーデックを指定 |
| `:v:0` | 最初の映像ストリーム | `-b:v:0 5M` 最初の映像ストリームのビットレート 5Mbps |
| `:a:1` | 2番目の音声ストリーム | `-c:a:1 ac3` 2番目の音声ストリームを AC3 でエンコード |

空の stream specifier はすべてのストリームにマッチします。例えば `-c copy` はすべてのストリームに copy を使用することと同義です。

### Stream Selection（ストリーム選択）

入力ファイルに複数のストリームが含まれている場合、FFmpeg はどのストリームを出力ファイルに含めるかを決定する必要があります。

**自動選択ルール**（`-map` を使用しない場合）：
- 映像：最も解像度の高い映像ストリームを選択
- 音声：最もチャンネル数の多い音声ストリームを選択
- 字幕：最初の字幕ストリームを選択（字幕に対応した出力形式の場合のみ）

**手動選択**では `-map` オプションを使用して正確に制御します。

```bash
# 1つ目の入力ファイルの映像ストリームと2つ目の入力ファイルの音声ストリームのみを使用
$ ffmpeg -i video.mp4 -i audio.m4a -map 0:v -map 1:a -c copy output.mp4

# すべてのストリームを使用
$ ffmpeg -i input.mkv -map 0 -c copy output.mp4

# 字幕ストリームを除外
$ ffmpeg -i input.mkv -map 0 -map -0:s -c copy output.mp4
```

### Filtergraph（フィルターグラフ）

FFmpeg のフィルターシステムは2つのカテゴリに分類されます。

**Simple filtergraph（シンプルフィルターグラフ）**：1つの入力と1つの出力を持ち、入出力のタイプは同一です。`-vf`（映像フィルター）または `-af`（音声フィルター）で指定します。

```bash
# 映像の拡大・縮小 + 切り抜き。複数のフィルターはカンマで連結
$ ffmpeg -i input.mp4 -vf "scale=1280:720,crop=1280:600:0:60" output.mp4

# 音量調整
$ ffmpeg -i input.mp4 -af "volume=1.5" output.mp4
```

**Complex filtergraph（複雑フィルターグラフ）**：複数の入力または複数の出力をサポートし、異なるタイプのストリームを混在させることができます。`-filter_complex` で指定し、`[ラベル]` を使用して入出力の端点をマークします。

```bash
# ピクチャー・イン・ピクチャー：overlay.mp4 を main.mp4 の右上に重ねる
$ ffmpeg -i main.mp4 -i overlay.mp4 \
  -filter_complex "[0:v][1:v]overlay=W-w-10:10[outv]" \
  -map "[outv]" -map 0:a output.mp4

# 2つの音声を1つにミックス
$ ffmpeg -i input1.mp4 -i input2.mp4 \
  -filter_complex "[0:a][1:a]amix=inputs=2[outa]" \
  -map 0:v -map "[outa]" output.mp4
```

複雑フィルターグラフにおけるラベルの説明：
- `[0:v]`：1つ目の入力ファイルの映像ストリーム
- `[1:a]`：2つ目の入力ファイルの音声ストリーム
- `[outv]`、`[outa]`：カスタム出力ラベル。`-map` で参照します

---

## FFmpeg コマンドラインツール

`FFmpeg` は3つの核となるコマンドラインツールを提供します。

| ツール | 用途 |
|------|------|
| `ffmpeg` | マルチメディアのエンコード・デコード、トランスコード、トランスマルチプレクシング |
| `ffprobe` | マルチメディアコンテンツの解析、情報抽出 |
| `ffplay` | SDL ベースのシンプルなマルチメディアプレイヤー |

### ffmpeg よく使うコマンド

**機能情報の確認：**

```bash
$ ffmpeg --help          # ヘルプの表示
$ ffmpeg -codecs         # サポートされているすべてのコーデックを表示
$ ffmpeg -encoders       # すべてのエンコーダを表示
$ ffmpeg -decoders       # すべてのデコーダを表示
$ ffmpeg -formats        # サポートされているすべてのカプセル化形式を表示
$ ffmpeg -filters        # すべてのフィルターを表示
$ ffmpeg -protocols      # サポートされているすべてのプロトコルを表示
```

**トランスコード：**

```bash
# 映像コーデック、ビットレート、フレームレートを指定し、音声を除去
$ ffmpeg -i input.rmvb -vcodec mpeg4 -b:v 200k -r 15 -an output.mp4
```

パラメータの説明：
- `-vcodec mpeg4`：映像コーデックに mpeg4 を指定
- `-b:v 200k`：映像ビットレート 200kbit/s
- `-r 15`：フレームレート 15fps
- `-an`：音声ストリームを除去（audio none）

**よく使う映像オプション：**

| オプション | 説明 | 例 |
|------|------|------|
| `-c:v` / `-vcodec` | 映像コーデック | `-c:v libx264` |
| `-b:v` | 映像ビットレート | `-b:v 2M` |
| `-r` | フレームレート | `-r 30` |
| `-s` | 解像度 | `-s 1920x1080` |
| `-vf` | 映像フィルター | `-vf "scale=1280:720"` |
| `-vn` | 映像ストリームを除去 | |
| `-pix_fmt` | ピクセルフォーマット | `-pix_fmt yuv420p` |
| `-crf` | 固定品質係数（H.264/H.265） | `-crf 23` |

**よく使う音声オプション：**

| オプション | 説明 | 例 |
|------|------|------|
| `-c:a` / `-acodec` | 音声コーデック | `-c:a aac` |
| `-b:a` | 音声ビットレート | `-b:a 128k` |
| `-ar` | サンプリングレート | `-ar 44100` |
| `-ac` | チャンネル数 | `-ac 2` |
| `-af` | 音声フィルター | `-af "volume=2.0"` |
| `-an` | 音声ストリームを除去 | |

**その他よく使うシナリオ：**

```bash
# 再エンコードせずにコンテナ形式のみ変換（非常に高速）
$ ffmpeg -i input.mp4 -c copy output.mkv

# 音声を抽出
$ ffmpeg -i input.mp4 -vn -acodec copy output.aac

# 一部分を切り出し（10秒目から30秒間）
$ ffmpeg -ss 10 -t 30 -i input.mp4 -c copy output.mp4

# 映像を720pにリサイズ
$ ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4

# 音声と映像を結合
$ ffmpeg -i video.mp4 -i audio.aac -c copy output.mp4

# CRFモードでエンコード（品質優先、ビットレート自動調整）
$ ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a aac -b:a 128k output.mp4

# 2パスエンコード（ビットレートがより均一に、固定ビットレートのシナリオに適する）
$ ffmpeg -i input.mp4 -c:v libx264 -b:v 2M -pass 1 -f null /dev/null
$ ffmpeg -i input.mp4 -c:v libx264 -b:v 2M -pass 2 output.mp4
```

### ffprobe よく使うコマンド

```bash
# ファイルのカプセル化形式情報を表示
$ ffprobe -show_format output.mp4

# すべてのデータパケット情報を表示
$ ffprobe -show_packets input.flv

# すべてのストリーム情報を表示
$ ffprobe -show_streams input.mp4

# JSON形式で出力（プログラムによる解析に便利）
$ ffprobe -v quiet -print_format json -show_format -show_streams input.mp4

# CSV形式でパケット情報を出力
$ ffprobe -of csv -show_packets input.flv
```

### ffplay よく使うコマンド

```bash
# 動画を再生
$ ffplay input.mp4

# 30秒目から再生を開始し、10秒間再生
$ ffplay -ss 30 -t 10 input.mp4

# 指定解像度の YUV 生ストリームを再生
$ ffplay -f rawvideo -pixel_format yuv420p -video_size 1920x1080 input.yuv

# ループ再生
$ ffplay -loop 0 input.mp4
```

---

## FFmpeg の基本構成

`ffmpeg -version` の出力を見ると、FFmpeg は主に8つのライブラリモジュールで構成されていることがわかります。それらの依存関係は以下の通りです。

```
┌─────────────────────────────────────────────────┐
│                  アプリケーション層                │
│          ffmpeg / ffprobe / ffplay               │
├─────────────────────────────────────────────────┤
│  libavdevice  │  libavfilter  │  libpostproc    │
├───────────────┴───────────────┴─────────────────┤
│        libavformat        │      libavcodec     │
├───────────────────────────┴─────────────────────┤
│      libswscale     │     libswresample         │
├─────────────────────┴───────────────────────────┤
│                   libavutil                       │
└─────────────────────────────────────────────────┘
```
```alert
type: info
description: 古いバージョンの FFmpeg には音声リサンプリング用の `libavresample` モジュールも含まれていましたが、現在は非推奨となっています。代わりに `libswresample` の使用が推奨されます。
```

### libavutil — 基本ユーティリティライブラリ

> The libavutil library is a utility library to aid portable multimedia programming.

共通の基本ユーティリティライブラリで、数学演算、文字列処理、メモリ管理、ログ、ピクセルフォーマットの記述、時間ベースの変換などの低レベル機能を提供します。他のすべてのライブラリが共通して依存する基盤です。

### libavcodec — コーデックライブラリ

> The libavcodec library provides a generic encoding/decoding framework and contains multiple decoders and encoders for audio, video and subtitle streams, and several bitstream filters.

FFmpeg の中核となるライブラリで、汎用的なエンコード・デコードフレームワークを提供します。膨大な数の音声、映像、字幕のコーデック実装を内蔵しており、外部ライブラリ（libx264、libx265、libopus など）を介してコーデック機能を拡張することも可能です。また、完全なデコードを行わずにビットストリームを変更できる、ビットストリームフィルターも含まれています。

### libavformat — カプセル化・デカプセル化ライブラリ

> The libavformat library provides a generic framework for multiplexing and demultiplexing (muxing and demuxing) audio, video and subtitle streams. It encompasses multiple muxers and demuxers for multimedia container formats. It also supports several input and output protocols to access a media resource.

マルチメディアコンテナフォーマットのカプセル化（mux）とデカプセル化（demux）を担当し、MP4、MKV、FLV、TS など数百ものフォーマットをサポートします。同時に、file、http、rtmp、hls など、ネットワークやファイルシステムからデータを読み書きするための多様な I/O プロトコル実装も内蔵しています。

### libavfilter — 音声・映像フィルターライブラリ

> The libavfilter library provides a generic audio/video filtering framework containing several filters, sources and sinks.

音声・映像のフィルター処理フレームワークを提供し、フィルターグラフ（filter graph）を構築して複雑な処理パイプラインを実現します。一般的なフィルターには、拡大・縮小（scale）、切り抜き（crop）、重ね合わせ（overlay）、ノイズ除去（denoise）、音量調整（volume）、リサンプリング（aresample）などがあります。

### libswscale — 画像拡大・縮小と色変換ライブラリ

> The libswscale library performs highly optimized image scaling and colorspace and pixel format conversion operations.

高度に最適化された画像処理ライブラリで、以下に特化しています。
- 画像の拡大・縮小（bilinear、bicubic、lanczos など複数の補間アルゴリズムに対応）
- 色空間の変換（例：YUV ↔ RGB）
- ピクセルフォーマットの変換（例：yuv420p → nv12）

### libswresample — 音声リサンプリングライブラリ

> The libswresample library performs highly optimized audio resampling, rematrixing and sample format conversion operations.

高度に最適化された音声処理ライブラリで、以下に特化しています。
- サンプリングレート変換（例：48kHz → 44.1kHz）
- チャンネルレイアウト変換（例：5.1ch サラウンド → ステレオ、すなわちリマトリキシング）
- サンプルフォーマット変換（例：float → s16）

### libavdevice — デバイス入出力ライブラリ

> The libavdevice library provides a generic framework for grabbing from and rendering to many common multimedia input/output devices, and supports several input and output devices, including Video4Linux2, VfW, DShow, and ALSA.

音声・映像デバイスからのキャプチャと出力機能を提供し、FFmpeg がハードウェアと直接やり取りできるようにします。対応デバイスは以下の通りです。
- Linux: Video4Linux2（カメラ）、ALSA（サウンドカード）、PulseAudio
- Windows: DirectShow、WASAPI
- macOS: AVFoundation

### libpostproc — 後処理ライブラリ

> The libpostproc library provides post-processing operations for video frames.

映像後処理ライブラリで、主にデコード後の映像フレームに対する画質向上処理（デブロッキング、デリンギングなど）に使用されます。H.264/H.265 にはループフィルターが組み込まれているため、現代のコーデックでは使用頻度は少なくなっています。

---

## まとめ

FFmpeg の設計は、優れた階層化アーキテクチャを体现しています。基本ユーティリティライブラリ（libavutil）がインフラを提供し、中間層（libavcodec、libavformat）が中核となるエンコード・デコードとカプセル化の能力を担い、上位層（libavfilter、libavdevice）が拡張機能を提供し、最終的にコマンドラインツール（ffmpeg、ffprobe、ffplay）が便利なユーザーインターフェースを提供します。

これらのコンポーネントの役割と境界を理解することは、実際の開発で適切な API を選択するのに役立つだけでなく、FFmpeg のコマンドライン引数の背後にあるロジックをより深く理解することにもつながります。

---

参考資料
- [FFmpeg 公式ドキュメント](https://ffmpeg.org/ffmpeg.html)
- [雷霄骅の FFmpeg ブログ](https://blog.csdn.net/leixiaohua1020)
- [FFmpeg Wiki](https://trac.ffmpeg.org/wiki)
