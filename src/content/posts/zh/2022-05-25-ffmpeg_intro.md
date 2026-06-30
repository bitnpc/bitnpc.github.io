---
title: 'FFmpeg 简介'
pubDate: 2022-05-25
categories: [音视频]
tags:
    - FFmpeg
    - 编解码

toc: true
description: 'FFmpeg 既是一款音视频编解码工具，也是一组音视频编解码开发套件。它是开源多媒体处理领域的事实标准，几乎所有的视频播放器、流媒体服务、视频编辑软件背后都依赖 FFmpeg。'
---

## FFmpeg 的定义

`FFmpeg` 既是一款音视频编解码工具，也是一组音视频编解码开发套件。它是开源多媒体处理领域的事实标准，几乎所有的视频播放器、流媒体服务、视频编辑软件背后都依赖 FFmpeg。

`FFmpeg` 支持多种协议，提供了多种多媒体格式的封装和解封装，音视频的编码、解码，采样率转换，码率转换，色彩格式转换等丰富的功能。

名称含义：
- **FF**：Fast Forward（快进）
- **mpeg**：Moving Picture Experts Group（动态图像专家组）

### 音视频基础概念

理解 FFmpeg 之前，需要先厘清音视频处理链路中的几个核心概念：

| 概念 | 说明 | 示例 |
|------|------|------|
| 协议（Protocol） | 数据传输的方式 | HLS、RTSP、RTMP、SRT |
| 封装格式（Container） | 将音视频编码流打包成文件的格式 | MP4、MKV、FLV、MOV、AVI |
| 编码格式（Codec） | 压缩音视频数据的算法 | H.264、H.265、VP9、AV1（视频）；AAC、Opus、MP3（音频） |

一个视频文件的层次结构：

```
┌─────────────────────────────────────┐
│         Container (如 MP4)           │
│  ┌───────────────────────────────┐  │
│  │  Video Stream (如 H.264)      │  │
│  ├───────────────────────────────┤  │
│  │  Audio Stream (如 AAC)        │  │
│  ├───────────────────────────────┤  │
│  │  Subtitle Stream (如 SRT)     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

一个封装文件可以包含多条音视频流（如多语言音轨、多字幕轨道）。

---

## FFmpeg 的安装与使用

在 `macOS` 平台上，可以使用 `homebrew` 安装 `ffmpeg` 的可执行文件：

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

### 命令语法结构

FFmpeg 的命令行语法遵循以下格式：

```
ffmpeg [global_options] {[input_file_options] -i input_url} ... {[output_file_options] output_url} ...
```

重要规则：
- **选项作用于紧随其后的文件**：写在 `-i` 前面的选项作用于输入文件，写在输出文件前面的选项作用于输出文件
- **顺序敏感**：所有输入必须在输出之前指定
- **全局选项**放在最前面，如 `-y`（覆盖输出文件）、`-n`（不覆盖）、`-v`（日志级别）

例如：
```bash
# -ss 放在 -i 前面：作为输入选项，精确到关键帧（快速但不精确）
$ ffmpeg -ss 30 -i input.mp4 -c copy output.mp4

# -ss 放在 -i 后面：作为输出选项，逐帧定位（精确但较慢）
$ ffmpeg -i input.mp4 -ss 30 -c copy output.mp4
```

### 一个简单的转码示例

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

该命令通过 `-i` 参数指定 `input.mp4` 作为输入源，然后进行转码和转封装操作，最后输出到 `output.avi` 文件。

从输出中可以看到：
- **输入**：封装格式 `mp4`，视频编码 `H.264`，音频编码 `AAC`
- **输出**：封装格式 `avi`，视频编码 `mpeg4`，音频编码 `MP3`
- **Stream mapping** 清楚地展示了转码路径

### FFmpeg 处理流程

FFmpeg 的核心处理流程如下图所示：

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

处理步骤：
1. **Demux（解封装）**：从容器中分离出音频、视频等各路压缩数据包（packets）
2. **Decode（解码）**：将压缩的数据包解码为原始帧（frames）—— 视频为 YUV/RGB 像素数据，音频为 PCM 采样数据
3. **Filter（滤镜处理，可选）**：对原始帧进行处理，如缩放、裁剪、加水印、调色等
4. **Encode（编码）**：将处理后的原始帧重新压缩编码
5. **Mux（封装）**：将编码后的数据包打包到目标容器格式中
```alert
type: success
description: 如果只是转封装（如 mp4 转 mkv）而不改变编码格式，可以使用 `-c copy` 跳过解码和编码步骤，速度极快且无质量损失。
```

### Stream Copy（流拷贝）

Stream copy 是 FFmpeg 提供的一种特殊模式，通过 `-c copy` 或 `-codec copy` 启用。在此模式下，FFmpeg 不会对数据进行解码和重新编码，而是直接将 demux 后的压缩数据包重新封装到输出容器中：

```
 _______              ______________            ________
|       |            |              |          |        |
| input |  demuxer   | encoded data |  muxer   | output |
| file  | ---------> | packets      | -------> | file   |
|_______|            |______________|          |________|
```

特点：
- 速度极快（不需要编解码运算）
- 无质量损失（数据未被修改）
- 无法应用滤镜（滤镜只能处理解码后的原始帧）
- 可能遇到时间戳或兼容性问题（源格式和目标格式的限制不同）

### Stream Specifier（流指定符）

某些选项是针对特定流（stream）的，需要通过 stream specifier 来指定作用对象。语法为在选项后附加 `:stream_specifier`：

```bash
# 语法格式
-option[:stream_specifier] value
```

常用的 stream specifier：

| 指定符 | 含义 | 示例 |
|--------|------|------|
| `:v` | 视频流 | `-c:v libx264` 指定视频编码器 |
| `:a` | 音频流 | `-c:a aac` 指定音频编码器 |
| `:s` | 字幕流 | `-c:s mov_text` 指定字幕编码器 |
| `:v:0` | 第一条视频流 | `-b:v:0 5M` 第一条视频流码率 5Mbps |
| `:a:1` | 第二条音频流 | `-c:a:1 ac3` 第二条音频流用 AC3 编码 |

空 stream specifier 匹配所有流，例如 `-c copy` 等同于对所有流都使用 copy。

### Stream Selection（流选择）

当输入文件包含多条流时，FFmpeg 需要决定哪些流进入输出文件。

**自动选择规则**（未使用 `-map` 时）：
- 视频：选择分辨率最高的视频流
- 音频：选择声道数最多的音频流
- 字幕：选择第一条字幕流（仅限支持字幕的输出格式）

**手动选择**使用 `-map` 选项精确控制：

```bash
# 只取第一个输入文件的视频流和第二个输入文件的音频流
$ ffmpeg -i video.mp4 -i audio.m4a -map 0:v -map 1:a -c copy output.mp4

# 取所有流
$ ffmpeg -i input.mkv -map 0 -c copy output.mp4

# 排除字幕流
$ ffmpeg -i input.mkv -map 0 -map -0:s -c copy output.mp4
```

### Filtergraph（滤镜图）

FFmpeg 的滤镜系统分为两类：

**Simple filtergraph（简单滤镜图）**：只有一个输入和一个输出，且输入输出类型相同。通过 `-vf`（视频滤镜）或 `-af`（音频滤镜）指定：

```bash
# 视频缩放 + 裁剪，多个滤镜用逗号连接
$ ffmpeg -i input.mp4 -vf "scale=1280:720,crop=1280:600:0:60" output.mp4

# 音频音量调整
$ ffmpeg -i input.mp4 -af "volume=1.5" output.mp4
```

**Complex filtergraph（复杂滤镜图）**：支持多个输入和/或多个输出，可以混合不同类型的流。通过 `-filter_complex` 指定，使用 `[label]` 来标记输入输出端点：

```bash
# 画中画：将 overlay.mp4 叠加到 main.mp4 右上角
$ ffmpeg -i main.mp4 -i overlay.mp4 \
  -filter_complex "[0:v][1:v]overlay=W-w-10:10[outv]" \
  -map "[outv]" -map 0:a output.mp4

# 将两路音频混合为一路
$ ffmpeg -i input1.mp4 -i input2.mp4 \
  -filter_complex "[0:a][1:a]amix=inputs=2[outa]" \
  -map 0:v -map "[outa]" output.mp4
```

复杂滤镜图中的标签说明：
- `[0:v]`：第一个输入文件的视频流
- `[1:a]`：第二个输入文件的音频流
- `[outv]`、`[outa]`：自定义的输出标签，用于 `-map` 引用

---

## FFmpeg 命令行工具

`FFmpeg` 提供三个核心命令行工具：

| 工具 | 用途 |
|------|------|
| `ffmpeg` | 多媒体编解码、转码、转封装 |
| `ffprobe` | 多媒体内容分析、信息提取 |
| `ffplay` | 基于 SDL 的简易多媒体播放器 |

### ffmpeg 常用命令

**查看功能信息：**

```bash
$ ffmpeg --help          # 查看帮助
$ ffmpeg -codecs         # 列出所有支持的编解码器
$ ffmpeg -encoders       # 列出所有编码器
$ ffmpeg -decoders       # 列出所有解码器
$ ffmpeg -formats        # 列出所有支持的封装格式
$ ffmpeg -filters        # 列出所有滤镜
$ ffmpeg -protocols      # 列出所有支持的协议
```

**转码：**

```bash
# 指定视频编码、码率、帧率，去掉音频
$ ffmpeg -i input.rmvb -vcodec mpeg4 -b:v 200k -r 15 -an output.mp4
```

参数说明：
- `-vcodec mpeg4`：指定视频编码器为 mpeg4
- `-b:v 200k`：视频码率 200kbit/s
- `-r 15`：帧率 15fps
- `-an`：去除音频流（audio none）

**常用视频选项：**

| 选项 | 说明 | 示例 |
|------|------|------|
| `-c:v` / `-vcodec` | 视频编码器 | `-c:v libx264` |
| `-b:v` | 视频码率 | `-b:v 2M` |
| `-r` | 帧率 | `-r 30` |
| `-s` | 分辨率 | `-s 1920x1080` |
| `-vf` | 视频滤镜 | `-vf "scale=1280:720"` |
| `-vn` | 去除视频流 | |
| `-pix_fmt` | 像素格式 | `-pix_fmt yuv420p` |
| `-crf` | 恒定质量因子（H.264/H.265） | `-crf 23` |

**常用音频选项：**

| 选项 | 说明 | 示例 |
|------|------|------|
| `-c:a` / `-acodec` | 音频编码器 | `-c:a aac` |
| `-b:a` | 音频码率 | `-b:a 128k` |
| `-ar` | 采样率 | `-ar 44100` |
| `-ac` | 声道数 | `-ac 2` |
| `-af` | 音频滤镜 | `-af "volume=2.0"` |
| `-an` | 去除音频流 | |

**更多常用场景：**

```bash
# 只转封装，不重新编码（速度极快）
$ ffmpeg -i input.mp4 -c copy output.mkv

# 提取音频
$ ffmpeg -i input.mp4 -vn -acodec copy output.aac

# 截取片段（从第 10 秒开始，截取 30 秒）
$ ffmpeg -ss 10 -t 30 -i input.mp4 -c copy output.mp4

# 缩放视频到 720p
$ ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4

# 合并音视频
$ ffmpeg -i video.mp4 -i audio.aac -c copy output.mp4

# 使用 CRF 模式编码（质量优先，码率自动调节）
$ ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a aac -b:a 128k output.mp4

# 两遍编码（码率更均匀，适合固定码率场景）
$ ffmpeg -i input.mp4 -c:v libx264 -b:v 2M -pass 1 -f null /dev/null
$ ffmpeg -i input.mp4 -c:v libx264 -b:v 2M -pass 2 output.mp4
```

### ffprobe 常用命令

```bash
# 查看文件的封装格式信息
$ ffprobe -show_format output.mp4

# 查看所有数据包信息
$ ffprobe -show_packets input.flv

# 查看所有流信息
$ ffprobe -show_streams input.mp4

# 以 JSON 格式输出（便于程序解析）
$ ffprobe -v quiet -print_format json -show_format -show_streams input.mp4

# 以 CSV 格式输出 Packets 信息
$ ffprobe -of csv -show_packets input.flv
```

### ffplay 常用命令

```bash
# 播放视频
$ ffplay input.mp4

# 从第 30 秒开始播放，播放 10 秒
$ ffplay -ss 30 -t 10 input.mp4

# 播放指定分辨率的 YUV 裸流
$ ffplay -f rawvideo -pixel_format yuv420p -video_size 1920x1080 input.yuv

# 循环播放
$ ffplay -loop 0 input.mp4
```

---

## FFmpeg 的基本组成

查看 `ffmpeg -version` 输出可以看到，FFmpeg 主要由 8 个库模块构成。它们之间的依赖关系如下：

```
┌─────────────────────────────────────────────────┐
│                  应用层工具                        │
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
description: 较老的 FFmpeg 版本还包含 `libavresample` 模块，用于音频重采样，现已废弃，推荐使用 `libswresample` 替代。
```

### libavutil — 基础工具库

> The libavutil library is a utility library to aid portable multimedia programming.

公共基础工具库，提供数学运算、字符串处理、内存管理、日志、像素格式描述、时间基转换等底层功能。是所有其他库的共同依赖。

### libavcodec — 编解码库

> The libavcodec library provides a generic encoding/decoding framework and contains multiple decoders and encoders for audio, video and subtitle streams, and several bitstream filters.

FFmpeg 最核心的库，提供通用的编解码框架。内置了大量音频、视频、字幕的编解码器实现，同时也支持通过外部库（如 libx264、libx265、libopus）来扩展编解码能力。还包含码流滤波器（bitstream filter），可在不完整解码的情况下修改码流。

### libavformat — 封装/解封装库

> The libavformat library provides a generic framework for multiplexing and demultiplexing (muxing and demuxing) audio, video and subtitle streams. It encompasses multiple muxers and demuxers for multimedia container formats. It also supports several input and output protocols to access a media resource.

负责多媒体容器格式的封装（mux）和解封装（demux），支持 MP4、MKV、FLV、TS 等数百种格式。同时内置了多种 I/O 协议的实现（如 file、http、rtmp、hls 等），负责从网络或文件系统读写数据。

### libavfilter — 音视频滤镜库

> The libavfilter library provides a generic audio/video filtering framework containing several filters, sources and sinks.

提供音视频滤镜处理框架，支持构建滤镜图（filter graph）实现复杂的处理流水线。常见滤镜包括：缩放（scale）、裁剪（crop）、叠加（overlay）、去噪（denoise）、音量调整（volume）、重采样（aresample）等。

### libswscale — 图像缩放与色彩转换库

> The libswscale library performs highly optimized image scaling and colorspace and pixel format conversion operations.

高度优化的图像处理库，专注于：
- 图像缩放（支持多种插值算法：bilinear、bicubic、lanczos 等）
- 色彩空间转换（如 YUV ↔ RGB）
- 像素格式转换（如 yuv420p → nv12）

### libswresample — 音频重采样库

> The libswresample library performs highly optimized audio resampling, rematrixing and sample format conversion operations.

高度优化的音频处理库，专注于：
- 采样率转换（如 48kHz → 44.1kHz）
- 声道布局转换（如 5.1 环绕声 → 立体声，即 rematrixing）
- 采样格式转换（如 float → s16）

### libavdevice — 设备输入输出库

> The libavdevice library provides a generic framework for grabbing from and rendering to many common multimedia input/output devices, and supports several input and output devices, including Video4Linux2, VfW, DShow, and ALSA.

提供音视频设备的采集和输出能力，使 FFmpeg 能直接与硬件交互。支持的设备包括：
- Linux: Video4Linux2（摄像头）、ALSA（声卡）、PulseAudio
- Windows: DirectShow、WASAPI
- macOS: AVFoundation

### libpostproc — 后处理库

> The libpostproc library provides post-processing operations for video frames.

视频后处理库，主要用于对解码后的视频帧进行质量增强（如去块效应 deblocking、去环效应 dering）。在现代编解码器中使用较少，因为 H.264/H.265 内置了环路滤波器。

---

## 总结

FFmpeg 的设计体现了良好的分层架构：底层工具库（libavutil）提供基础设施，中间层（libavcodec、libavformat）负责核心的编解码和封装能力，上层（libavfilter、libavdevice）提供扩展功能，最终由命令行工具（ffmpeg、ffprobe、ffplay）对外提供便捷的使用接口。

理解这些组件的职责边界，有助于在实际开发中正确选择 API，也能更好地理解 FFmpeg 命令行参数的逻辑。

---

参考资料
- [FFmpeg 官方文档](https://ffmpeg.org/ffmpeg.html)
- [雷霄骅的 FFmpeg 博客](https://blog.csdn.net/leixiaohua1020)
- [FFmpeg Wiki](https://trac.ffmpeg.org/wiki)
