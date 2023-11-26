---
layout: post
title: "FFmpeg 简介"
date: 2022-05-25
categories: [技术, 音视频]
tags:
    - FFmpeg
    - 音视频
---

## FFmpeg 的定义
`FFmpeg` 既是一款音视频编解码工具，也是一组音视频编解码开发套件。
`FFmpeg` 支持多种协议，提供了多种多媒体格式的封装和解封装，音视频的编码、解码，采样率转换，码率转换，色彩格式转换等丰富的功能。
FF: `fast forword`
mpeg: `Moving Picture Experts Group`

### 音视频其他概念
- 协议：如 HLS，rtsp
- 封装格式：如 `mov`，`mp4`，`mkv`，`rmvb`。一个视频文件可以封装多组音视频编码流
- 编码格式：视频编码如 `H.264`，`HEVC(H.265)`，音频编码如 `mp3`，`aac`，`G.711`，`opus`

## FFmpeg 的使用
在 `macOS` 平台上，可以使用 `homebrew` 安装 `ffmpeg` 的可执行文件

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

一个简单的例子
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
frame=    1 fps=0.0 q=6.9 size=     133kB time=00:00:00.15 bitrate=6965.1kbits/s speed=9.2frame=   94 fps=0.0 q=31.0 size=    2816kB time=00:00:03.26 bitrate=7064.8kbits/s speed=6.frame=  201 fps=197 q=31.0 size=    4864kB time=00:00:06.81 bitrate=5844.3kbits/s speed=6.frame=  228 fps=202 q=31.0 Lsize=    5363kB time=00:00:07.60 bitrate=5775.1kbits/s speed=6.74x
video:5221kB audio:120kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: 0.412835%
```

该命令，通过 `-i` 参数指定 `input.mp4` 作为输入源，然后进行转码和转封装操作，最后输出到 `output.avi` 文件。
可以看到，`input.mp4` 的封装格式为 `mp4`，视频编码为 `h.264`，音频编码为 `aac`。`output.avi` 的封装格式为 `avi`，视频编码为 `mpeg4`，音频编码为 `mp3`。
转化的流程图如下：

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

`FFmpeg` 中常用的工具主要是 `ffmpeg`、`ffprobe`、`ffplay`。他们分别用户多媒体的编解码工具，内容分析工具和播放器。

### ffmpeg 常用命令
- 功能介绍类

```bash
$ ffmpeg --help
$ ffmpeg -codecs
$ ffmpeg -encoders
$ ffmpeg -decoders
$ ffmpeg -filters
```

- 转码类
```bash
$ ffmpeg -i input.rmvb -vcodec mpeg4 -b:v 200k -r 15 -an output.mp4
```
封装格式由 `rmvb` 转成 `mp4`，视频编码指定为 `mpeg4`，视频码率指定 `200kbit/s`，视频帧率指定为 `15fps`，转码后的文件不包含音频（`-an` 参数）

### ffprobe 常用命令
```bash
$ ffprobe -show_packets input.flv
$ ffprobe -show_format output.mp4
# 以 CSV 文档输出 Packets 信息
$ ffprobe -of csv -show_packets input.flv
```

### ffplay 常用命令
```bash
# 从视频的第 30 秒开始播放，播放 10 秒中的文件
$ ffplay -ss 30 -t 10 input.mp4
```

## FFmpeg 的基本组成
查看 `ffmpeg` 版本时可以看到，`ffmpeg` 主要由 8 个模块构成，包括 `libavutil`，`libavcodec`，`libavformat`，`libavdevice`，`libavfilter`，`libswscale`，`libswresample`，`libpostproc`。
比较老的 `ffmpeg` 版本还会编译出 `libavresample` 模块，也是用于对音频原始出具进行重采样的，已被废弃，推荐使用 `libswresample` 替代。

### libavutil
The libavutil library is a utility library to aid portable multimedia programming

### libswscale
The libswscale library performs highly optimized image scaling and colorspace and pixel format conversion operations.

### libswresample
The libswresample library performs highly optimized audio resampling, rematrixing and sample format conversion operations.

### libavcodec
The libavcodec library provides a generic encoding/decoding framework and contains multiple decoders and encoders for audio, video and subtitle streams, and several bitstream filters.
The shared architecture provides various services ranging from bit stream I/O to DSP optimizations, and makes it suitable for implementing robust and fast codecs as well as for experimentation.

### libavformat
The libavformat library provides a generic framework for multiplexing and demultiplexing (muxing and demuxing) audio, video and subtitle streams. It encompasses multiple muxers and demuxers for multimedia container formats.
It also supports several input and output protocols to access a media resource.

### libavdevice
The libavdevice library provides a generic framework for grabbing from and rendering to many common multimedia input/output devices, and supports several input and output devices, including Video4Linux2, VfW, DShow, and ALSA.

### libavfilter
The libavfilter library provides a generic audio/video filtering framework containing several filters, sources and sinks.


参考资料
- https://ffmpeg.org/ffmpeg.html
- https://blog.csdn.net/leixiaohua1020
