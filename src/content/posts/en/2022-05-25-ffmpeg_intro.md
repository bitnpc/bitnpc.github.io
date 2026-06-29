---
title: 'Introduction to FFmpeg'
pubDate: 2022-05-25
categories: [Tech, Audio & Video]
tags:
    - FFmpeg
    - Audio & Video
toc: true
description: 'An introduction to FFmpeg covering installation, command-line syntax, transcoding, stream selection, filtergraphs, and the architecture of its core library modules.'
---

## What is FFmpeg

`FFmpeg` is both an audio/video codec tool and a set of audio/video codec development libraries. It is the de facto standard in the open-source multimedia processing domain — nearly every video player, streaming service, and video editing application relies on FFmpeg under the hood.

`FFmpeg` supports a wide range of protocols and provides rich features including multiplexing and demultiplexing of various multimedia formats, audio/video encoding and decoding, sample rate conversion, bitrate conversion, and color format conversion.

Name breakdown:
- **FF**: Fast Forward
- **mpeg**: Moving Picture Experts Group

### Core Audio/Video Concepts

Before understanding FFmpeg, it is important to clarify several core concepts in the audio/video processing pipeline:

| Concept | Description | Examples |
|---------|-------------|---------|
| Protocol | Method of data transmission | HLS, RTSP, RTMP, SRT |
| Container | Format that packages encoded streams into a file | MP4, MKV, FLV, MOV, AVI |
| Codec | Algorithm for compressing audio/video data | H.264, H.265, VP9, AV1 (video); AAC, Opus, MP3 (audio) |

The hierarchical structure of a video file:

```
┌─────────────────────────────────────┐
│         Container (e.g., MP4)        │
│  ┌───────────────────────────────┐  │
│  │  Video Stream (e.g., H.264)   │  │
│  ├───────────────────────────────┤  │
│  │  Audio Stream (e.g., AAC)     │  │
│  ├───────────────────────────────┤  │
│  │  Subtitle Stream (e.g., SRT)  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

A single container file can contain multiple audio/video streams (e.g., multi-language audio tracks, multiple subtitle tracks).

---

## FFmpeg Installation and Usage

On `macOS`, you can install the `ffmpeg` executable using `homebrew`:

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

### Command Syntax

FFmpeg's command-line syntax follows this format:

```
ffmpeg [global_options] {[input_file_options] -i input_url} ... {[output_file_options] output_url} ...
```

Important rules:
- **Options apply to the file that follows them**: options placed before `-i` affect the input file; options placed before the output file affect the output
- **Order-sensitive**: all inputs must be specified before any outputs
- **Global options** go first, e.g., `-y` (overwrite output file), `-n` (do not overwrite), `-v` (log level)

For example:
```bash
# -ss before -i: input option, seeks to nearest keyframe (fast but imprecise)
$ ffmpeg -ss 30 -i input.mp4 -c copy output.mp4

# -ss after -i: output option, frame-accurate seeking (precise but slower)
$ ffmpeg -i input.mp4 -ss 30 -c copy output.mp4
```

### A Simple Transcoding Example

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

This command uses the `-i` parameter to specify `input.mp4` as the input source, then performs transcoding and remuxing, and finally outputs to `output.avi`.

From the output, we can see:
- **Input**: container format `mp4`, video codec `H.264`, audio codec `AAC`
- **Output**: container format `avi`, video codec `mpeg4`, audio codec `MP3`
- The **Stream mapping** clearly shows the transcoding path

### FFmpeg Processing Pipeline

FFmpeg's core processing pipeline is illustrated below:

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

Processing steps:
1. **Demux**: Extract compressed data packets (audio, video, etc.) from the container
2. **Decode**: Decompress the data packets into raw frames — YUV/RGB pixel data for video, PCM sample data for audio
3. **Filter (optional)**: Process raw frames — scaling, cropping, watermarking, color grading, etc.
4. **Encode**: Re-compress the processed raw frames
5. **Mux**: Package the encoded data packets into the target container format
```alert
type: success
description: If you only need to remux (e.g., MP4 to MKV) without changing the codec, use `-c copy` to skip the decoding and encoding steps — extremely fast with no quality loss.
```

### Stream Copy

Stream copy is a special mode in FFmpeg enabled via `-c copy` or `-codec copy`. In this mode, FFmpeg does not decode and re-encode the data; instead, it directly repackages the demuxed compressed packets into the output container:

```
 _______              ______________            ________
|       |            |              |          |        |
| input |  demuxer   | encoded data |  muxer   | output |
| file  | ---------> | packets      | -------> | file   |
|_______|            |______________|          |________|
```

Characteristics:
- Extremely fast (no encoding/decoding computation)
- No quality loss (data is not modified)
- Cannot apply filters (filters only work on decoded raw frames)
- May encounter timestamp or compatibility issues (different constraints between source and target formats)

### Stream Specifier

Certain options target specific streams and require a stream specifier. The syntax appends `:stream_specifier` after the option:

```bash
# Syntax
-option[:stream_specifier] value
```

Common stream specifiers:

| Specifier | Meaning | Example |
|-----------|---------|---------|
| `:v` | Video stream | `-c:v libx264` specifies the video encoder |
| `:a` | Audio stream | `-c:a aac` specifies the audio encoder |
| `:s` | Subtitle stream | `-c:s mov_text` specifies the subtitle encoder |
| `:v:0` | First video stream | `-b:v:0 5M` bitrate of 5 Mbps for the first video stream |
| `:a:1` | Second audio stream | `-c:a:1 ac3` use AC3 encoder for the second audio stream |

An empty stream specifier matches all streams. For example, `-c copy` applies copy to all streams.

### Stream Selection

When the input file contains multiple streams, FFmpeg needs to decide which streams go into the output file.

**Automatic selection rules** (when `-map` is not used):
- Video: selects the video stream with the highest resolution
- Audio: selects the audio stream with the most channels
- Subtitle: selects the first subtitle stream (only for output formats that support subtitles)

**Manual selection** uses the `-map` option for precise control:

```bash
# Take only the video stream from the first input and the audio stream from the second input
$ ffmpeg -i video.mp4 -i audio.m4a -map 0:v -map 1:a -c copy output.mp4

# Take all streams
$ ffmpeg -i input.mkv -map 0 -c copy output.mp4

# Exclude subtitle streams
$ ffmpeg -i input.mkv -map 0 -map -0:s -c copy output.mp4
```

### Filtergraph

FFmpeg's filter system is divided into two categories:

**Simple filtergraph**: has only one input and one output, with the same stream type on both ends. Specified via `-vf` (video filter) or `-af` (audio filter):

```bash
# Video scaling + cropping, multiple filters connected with commas
$ ffmpeg -i input.mp4 -vf "scale=1280:720,crop=1280:600:0:60" output.mp4

# Audio volume adjustment
$ ffmpeg -i input.mp4 -af "volume=1.5" output.mp4
```

**Complex filtergraph**: supports multiple inputs and/or multiple outputs, and can mix different stream types. Specified via `-filter_complex`, using `[label]` to mark input and output endpoints:

```bash
# Picture-in-picture: overlay overlay.mp4 onto the top-right corner of main.mp4
$ ffmpeg -i main.mp4 -i overlay.mp4 \
  -filter_complex "[0:v][1:v]overlay=W-w-10:10[outv]" \
  -map "[outv]" -map 0:a output.mp4

# Mix two audio streams into one
$ ffmpeg -i input1.mp4 -i input2.mp4 \
  -filter_complex "[0:a][1:a]amix=inputs=2[outa]" \
  -map 0:v -map "[outa]" output.mp4
```

Label explanations in complex filtergraphs:
- `[0:v]`: video stream from the first input file
- `[1:a]`: audio stream from the second input file
- `[outv]`, `[outa]`: custom output labels, referenced by `-map`

---

## FFmpeg Command-Line Tools

`FFmpeg` provides three core command-line tools:

| Tool | Purpose |
|------|---------|
| `ffmpeg` | Multimedia encoding, decoding, transcoding, and remuxing |
| `ffprobe` | Multimedia content analysis and information extraction |
| `ffplay` | SDL-based simple multimedia player |

### ffmpeg Common Commands

**Viewing feature information:**

```bash
$ ffmpeg --help          # View help
$ ffmpeg -codecs         # List all supported codecs
$ ffmpeg -encoders       # List all encoders
$ ffmpeg -decoders       # List all decoders
$ ffmpeg -formats        # List all supported container formats
$ ffmpeg -filters        # List all filters
$ ffmpeg -protocols      # List all supported protocols
```

**Transcoding:**

```bash
# Specify video codec, bitrate, framerate, remove audio
$ ffmpeg -i input.rmvb -vcodec mpeg4 -b:v 200k -r 15 -an output.mp4
```

Parameter explanations:
- `-vcodec mpeg4`: set the video codec to mpeg4
- `-b:v 200k`: video bitrate of 200 kbit/s
- `-r 15`: framerate of 15 fps
- `-an`: remove audio stream (audio none)

**Common video options:**

| Option | Description | Example |
|--------|-------------|---------|
| `-c:v` / `-vcodec` | Video codec | `-c:v libx264` |
| `-b:v` | Video bitrate | `-b:v 2M` |
| `-r` | Framerate | `-r 30` |
| `-s` | Resolution | `-s 1920x1080` |
| `-vf` | Video filter | `-vf "scale=1280:720"` |
| `-vn` | Remove video stream | |
| `-pix_fmt` | Pixel format | `-pix_fmt yuv420p` |
| `-crf` | Constant Rate Factor (H.264/H.265) | `-crf 23` |

**Common audio options:**

| Option | Description | Example |
|--------|-------------|---------|
| `-c:a` / `-acodec` | Audio codec | `-c:a aac` |
| `-b:a` | Audio bitrate | `-b:a 128k` |
| `-ar` | Sample rate | `-ar 44100` |
| `-ac` | Number of audio channels | `-ac 2` |
| `-af` | Audio filter | `-af "volume=2.0"` |
| `-an` | Remove audio stream | |

**More common use cases:**

```bash
# Remux only, no re-encoding (extremely fast)
$ ffmpeg -i input.mp4 -c copy output.mkv

# Extract audio
$ ffmpeg -i input.mp4 -vn -acodec copy output.aac

# Cut a segment (starting at 10 seconds, duration 30 seconds)
$ ffmpeg -ss 10 -t 30 -i input.mp4 -c copy output.mp4

# Scale video to 720p
$ ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4

# Merge audio and video
$ ffmpeg -i video.mp4 -i audio.aac -c copy output.mp4

# Encode using CRF mode (quality-first, bitrate auto-adjusts)
$ ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a aac -b:a 128k output.mp4

# Two-pass encoding (more uniform bitrate, suitable for fixed-bitrate scenarios)
$ ffmpeg -i input.mp4 -c:v libx264 -b:v 2M -pass 1 -f null /dev/null
$ ffmpeg -i input.mp4 -c:v libx264 -b:v 2M -pass 2 output.mp4
```

### ffprobe Common Commands

```bash
# View container format information
$ ffprobe -show_format output.mp4

# View all packet information
$ ffprobe -show_packets input.flv

# View all stream information
$ ffprobe -show_streams input.mp4

# Output in JSON format (easier for programmatic parsing)
$ ffprobe -v quiet -print_format json -show_format -show_streams input.mp4

# Output packet info in CSV format
$ ffprobe -of csv -show_packets input.flv
```

### ffplay Common Commands

```bash
# Play a video
$ ffplay input.mp4

# Start playback from the 30-second mark, play for 10 seconds
$ ffplay -ss 30 -t 10 input.mp4

# Play a raw YUV stream at specified resolution
$ ffplay -f rawvideo -pixel_format yuv420p -video_size 1920x1080 input.yuv

# Loop playback
$ ffplay -loop 0 input.mp4
```

---

## FFmpeg Architecture

From the `ffmpeg -version` output, we can see that FFmpeg is primarily composed of 8 library modules. Their dependency relationships are as follows:

```
┌─────────────────────────────────────────────────┐
│                Application Layer Tools            │
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
description: Older versions of FFmpeg also include the `libavresample` module for audio resampling, which is now deprecated. It is recommended to use `libswresample` instead.
```

### libavutil — Utility Library

> The libavutil library is a utility library to aid portable multimedia programming.

A common utility library providing low-level functionality such as math operations, string processing, memory management, logging, pixel format descriptions, and timebase conversion. It is a shared dependency for all other libraries.

### libavcodec — Codec Library

> The libavcodec library provides a generic encoding/decoding framework and contains multiple decoders and encoders for audio, video and subtitle streams, and several bitstream filters.

FFmpeg's most core library, providing a generic encoding/decoding framework. It includes a large number of built-in audio, video, and subtitle codec implementations, and also supports extending codec capabilities through external libraries (e.g., libx264, libx265, libopus). It also includes bitstream filters that can modify bitstreams without fully decoding them.

### libavformat — Muxing/Demuxing Library

> The libavformat library provides a generic framework for multiplexing and demultiplexing (muxing and demuxing) audio, video and subtitle streams. It encompasses multiple muxers and demuxers for multimedia container formats. It also supports several input and output protocols to access a media resource.

Responsible for multiplexing (mux) and demultiplexing (demux) of multimedia container formats, supporting hundreds of formats including MP4, MKV, FLV, and TS. It also includes implementations of various I/O protocols (such as file, http, rtmp, hls, etc.) for reading and writing data from networks or file systems.

### libavfilter — Audio/Video Filter Library

> The libavfilter library provides a generic audio/video filtering framework containing several filters, sources and sinks.

Provides an audio/video filter processing framework that supports building filter graphs for complex processing pipelines. Common filters include: scale, crop, overlay, denoise, volume adjustment, and aresample.

### libswscale — Image Scaling and Color Conversion Library

> The libswscale library performs highly optimized image scaling and colorspace and pixel format conversion operations.

A highly optimized image processing library focused on:
- Image scaling (supports multiple interpolation algorithms: bilinear, bicubic, lanczos, etc.)
- Color space conversion (e.g., YUV ↔ RGB)
- Pixel format conversion (e.g., yuv420p → nv12)

### libswresample — Audio Resampling Library

> The libswresample library performs highly optimized audio resampling, rematrixing and sample format conversion operations.

A highly optimized audio processing library focused on:
- Sample rate conversion (e.g., 48kHz → 44.1kHz)
- Channel layout conversion (e.g., 5.1 surround → stereo, also known as rematrixing)
- Sample format conversion (e.g., float → s16)

### libavdevice — Device Input/Output Library

> The libavdevice library provides a generic framework for grabbing from and rendering to many common multimedia input/output devices, and supports several input and output devices, including Video4Linux2, VfW, DShow, and ALSA.

Provides audio/video device capture and output capabilities, enabling FFmpeg to interact directly with hardware. Supported devices include:
- Linux: Video4Linux2 (camera), ALSA (sound card), PulseAudio
- Windows: DirectShow, WASAPI
- macOS: AVFoundation

### libpostproc — Post-Processing Library

> The libpostproc library provides post-processing operations for video frames.

A video post-processing library primarily used for quality enhancement of decoded video frames (e.g., deblocking, dering). It is less commonly used with modern codecs since H.264/H.265 include in-loop filters.

---

## Summary

FFmpeg's design reflects a well-structured layered architecture: the low-level utility library (libavutil) provides infrastructure, the middle layer (libavcodec, libavformat) handles core codec and container capabilities, the upper layer (libavfilter, libavdevice) provides extended features, and finally the command-line tools (ffmpeg, ffprobe, ffplay) offer a convenient interface for end users.

Understanding the responsibilities of these components helps in choosing the right API during development and provides deeper insight into the logic behind FFmpeg command-line parameters.

---

References
- [FFmpeg Official Documentation](https://ffmpeg.org/ffmpeg.html)
- [Lei Xiaohua's FFmpeg Blog](https://blog.csdn.net/leixiaohua1020)
- [FFmpeg Wiki](https://trac.ffmpeg.org/wiki)
