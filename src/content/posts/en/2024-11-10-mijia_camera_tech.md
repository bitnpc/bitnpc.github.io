---
title: 'Mijia Camera Technology: A Complete Breakdown'
pubDate: 2024-11-10
categories: [Smart Home]
tags:
  - Audio/Video
  - P2P
  - Embedded

toc: true
description: 'A systematic breakdown of building an industrial-grade Mijia smart camera from three angles: hardware design, software architecture, and cloud services. Uses the PTZ indoor camera as the main thread.'
---

This article systematically walks through how to build an industrial-grade Mijia smart camera product from three perspectives: hardware design, software architecture, and cloud services. It uses the PTZ indoor camera as the main thread while covering the differences of other form factors such as the bullet-and-ball dual-lens camera.

The technology stacks covered here have dedicated articles in previous blog posts — read them together for deeper understanding:

- [Audio/Video Fundamentals and Digital Representation](https://bitnpc.github.io/posts/av_into/) — Sampling, encoding, color spaces, and other basic concepts
- [Introduction to P2P Technology](https://bitnpc.github.io/posts/p2p_intro/) — NAT traversal and hole punching principles
- [HLS and Cloud Storage](https://bitnpc.github.io/posts/hls_intro/) — Streaming media segmentation, storage, and playback
- [Introduction to Matter Protocol](https://bitnpc.github.io/posts/matter/) — Comparison with the Mijia IoT SPEC

---

## 1. Hardware Design

### 1.1 System Block Diagram

```
                            ┌─────────────┐
                            │  Lens Module │
                            │ (Lens+CMOS) │
                            └──────┬──────┘
                                   │ MIPI CSI
┌─────────┐    I2S     ┌──────────┴──────────┐     SDIO/USB     ┌──────────┐
│ Mic     │───────────►│                      │◄───────────────►│  Wi-Fi   │
│ (MIC)   │            │     Main SoC        │                 │  Module  │
└─────────┘            │  (SigmaStar/Ingenic) │                 └──────────┘
                       │                      │     SPI/eMMC
┌─────────┐    PWM     │  CPU + ISP + NPU    │◄───────────────►┌──────────┐
│ Speaker │◄───────────│  + Video Encoder     │                 │  Flash   │
│         │    DAC     │                      │                 │(NOR/NAND)│
└─────────┘            └──┬───┬───┬───┬──────┘                 └──────────┘
                          │   │   │   │
                    GPIO  │   │   │   │ DDR
              ┌───────────┘   │   │   └────────┐
              │               │   │            │
        ┌─────┴─────┐   ┌────┴───┴──┐    ┌────┴────┐
        │  IR LED   │   │ PTZ Motor │    │  DDR    │
        │  + IR-CUT │   │ (Stepper/ │    │  Memory │
        └───────────┘   │  DC)      │    └─────────┘
                        └───────────┘
```

### 1.2 Main SoC

The main SoC is the camera's core, integrating the CPU, ISP (Image Signal Processor), video encoding engine, and NPU (AI inference) on a single chip.

**Common solutions:**

| Chip     | Vendor    | CPU                     | NPU Performance | Video Capability      | Target Scenarios           |
| -------- | --------- | ----------------------- | --------------- | --------------------- | -------------------------- |
| SSC337DE | SigmaStar | Cortex-A7 Dual-core     | 0.5~1 TOPS      | 3MP@30fps H.265       | Low-to-mid-range PTZ       |
| SSC377   | SigmaStar | Cortex-A7 Dual-core     | ~2 TOPS         | 5MP@30fps H.265       | Mid-to-high-end / Dual-cam |
| T40XP    | Ingenic   | MIPS XBurst2 Dual-core  | 3.2 TOPS        | 5MP@30fps H.265/H.264 | High-end / AI-enhanced     |
| T31      | Ingenic   | MIPS XBurst Single-core | Limited         | 3MP@25fps             | Low-cost / Low-power       |

**Key selection criteria:**

- **ISP quality**: Directly determines image quality (noise reduction, WDR, 3D-DNR)
- **Encoder capability**: Must support simultaneous multi-stream encoding (main stream + substream + AI frames)
- **NPU performance**: Determines how many AI models can run (human detection + face recognition requires ≥1 TOPS)
- **Memory bandwidth**: Video + AI + ISP working concurrently demands high bandwidth

### 1.3 DDR Memory

| Type       | Capacity  | Notes                                                |
| ---------- | --------- | ---------------------------------------------------- |
| DDR2       | 64MB      | Low-end models, barely enough for basic video        |
| DDR3/DDR3L | 128~256MB | Mainstream solution, sufficient for video + AI + P2P |
| LPDDR4     | 256~512MB | High-end dual-cam or multi-tasking scenarios         |

Memory allocation example (128MB):

- Linux kernel + userspace: ~30MB
- Video encoding buffers (main/substream): ~40MB
- ISP image pipeline buffers: ~20MB
- AI inference tensor buffers: ~20MB
- P2P / network buffers: ~10MB
- Reserved / fragmentation: ~8MB

### 1.4 Storage (Flash)

| Type           | Capacity        | Typical Use                                   |
| -------------- | --------------- | --------------------------------------------- |
| SPI NOR Flash  | 8~32MB          | Bootloader + kernel + rootfs (minimal system) |
| SPI NAND Flash | 128~256MB       | Full system + model files + recording cache   |
| eMMC           | 512MB~8GB       | High-end solution, supports local recording   |
| TF Card Slot   | User-expandable | Local recording storage (up to 256GB)         |

**Partition layout (typical SPI NAND 128MB):**

```
┌──────────────────────────────────────────────────────┐
│ boot (1MB) │ kernel (4MB) │ rootfs (40MB) │ data (80MB) │
│  U-Boot    │   uImage     │  squashfs     │  jffs2/ubifs │
└──────────────────────────────────────────────────────┘
```

- `rootfs`: Read-only squashfs, immune to corruption from power loss
- `data`: Writable partition for configuration files, AI models, logs, etc.
- Dual A/B partition scheme prevents bricking during OTA

### 1.5 CMOS Image Sensor

| Model   | Vendor     | Resolution      | Pixel Size | Target Scenarios       |
| ------- | ---------- | --------------- | ---------- | ---------------------- |
| SC3336  | SmartSens  | 3MP (2304x1296) | 2.5μm      | Mainstream home use    |
| SC5235  | SmartSens  | 5MP (2592x1944) | 2.0μm      | High-definition        |
| IMX307  | Sony       | 2MP (1920x1080) | 2.9μm      | Starlight night vision |
| OS04A10 | OmniVision | 4MP (2560x1440) | 2.0μm      | Mid-to-high-end        |

**Selection considerations:**

- **Pixel size**: Larger means more light intake, better night vision
- **Sensitivity**: Determines noise levels in low-light conditions
- **Shutter mode**: Rolling shutter (lower cost) vs. Global shutter (no jelly effect on motion)
- **Interface**: MIPI CSI-2, 2-lane or 4-lane
- **Power consumption**: Affects overall thermal design

### 1.6 Lens

| Parameter    | Typical Value         | Notes                                                                              |
| ------------ | --------------------- | ---------------------------------------------------------------------------------- |
| Focal length | 3.6mm / 2.8mm         | Shorter focal length = wider field of view                                         |
| Aperture     | F2.0 / F1.6           | Wider aperture = more light, better night vision                                   |
| FOV          | Horizontal 110°~130°  | Home use generally requires ≥110°                                                  |
| IR-CUT       | Dual filter switching | Daytime: blocks IR for natural color; Nighttime: removes filter for IR sensitivity |
| Focus        | Fixed                 | PTZ indoor cameras generally use fixed focus to reduce cost                        |

Lens mount: Typically M12 (S-Mount), secured with thread-locking adhesive after focus adjustment.

### 1.7 Wi-Fi Module

| Solution   | Band            | Notes                                                           |
| ---------- | --------------- | --------------------------------------------------------------- |
| RTL8189FTV | 2.4GHz          | Low-cost SDIO interface, supports 802.11 b/g/n                  |
| RTL8733BU  | 2.4G + 5G + BLE | Dual-band + Bluetooth, USB interface, supports BLE provisioning |
| SSW101B    | 2.4GHz          | SigmaStar companion solution, SDIO                              |

**Key selection criteria:**

- **Throughput**: 1080P@30fps H.265 main stream is about 2~4Mbps, needs stable Wi-Fi bandwidth
- **Interference resistance**: 2.4G band is crowded in homes; MIMO or 5G support recommended
- **Power consumption**: Affects device temperature
- **BLE provisioning**: Dual-mode chip enables BLE provisioning for better user experience

### 1.8 PTZ Motor

PTZ cameras use mechanical rotation for horizontal (Pan) and vertical (Tilt) movement:

| Parameter      | Pan                       | Tilt           |
| -------------- | ------------------------- | -------------- |
| Motor type     | Stepper motor             | Stepper motor  |
| Rotation range | 360°                      | 90°~120°       |
| Step angle     | Typically 1/16 microstep  | Same           |
| Gear ratio     | Gear reduction            | Gear reduction |
| Homing method  | Optocoupler / Hall sensor | Same           |
| Driver IC      | e.g. MS41929              | Same           |

**Control logic:**

- On power-up, determine zero position via homing sensor
- App sends rotation angle command, converted to step pulse count
- Supports presets, patrol, tracking, and other advanced features
- Noise optimization required (microstep driving + gear ratio design)

**Bullet-and-ball dual-lens differences**: The dual-lens form factor typically has one fixed wide-angle lens + one varifocal PTZ lens, working together to achieve "panoramic tracking + close-up capture."

### 1.9 IR LED and IR-CUT

```
Day mode:                        Night mode:
┌─────────┐                    ┌─────────┐
│  Lens   │                    │  Lens   │
│  ↓      │                    │  ↓      │
│ IR-CUT  │ ← Filter blocks IR │ IR-CUT  │ ← Filter moved away
│ (block) │                    │ (open)  │
│  ↓      │                    │  ↓      │
│ CMOS    │                    │ CMOS    │ ← Receives 850nm/940nm IR light
└─────────┘                    └─────────┘
                                   ↑
                              IR LED illumination
```

- **850nm IR LED**: Faint red glow, longer illumination range
- **940nm IR LED**: Completely invisible to the naked eye, suitable for covert scenarios
- **IR-CUT switch**: Automatically controlled by ISP based on ambient light levels

### 1.10 Microphone and Speaker

| Component         | Specification                         | Notes                                                            |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Microphone        | Electret / MEMS                       | Audio pickup, cry detection, two-way talk                        |
| Speaker           | 8Ω 1W~2W                              | Talkback playback, alarm siren                                   |
| Audio Codec       | SoC-integrated / External e.g. ES8388 | ADC (MIC → digital) + DAC (digital → speaker)                    |
| Echo Cancellation | Software AEC algorithm                | Eliminates speaker crosstalk into microphone during two-way talk |

Talkback path: App voice → P2P → device decode → DAC → speaker; device MIC → ADC → AEC → encode → P2P → App

### 1.11 Power Supply Design

| Solution        | Input             | Notes                                 |
| --------------- | ----------------- | ------------------------------------- |
| DC 5V/2A        | Micro-USB / USB-C | Standard indoor PTZ camera power      |
| DC 12V/1A       | DC barrel jack    | Outdoor bullet camera, PoE power      |
| Battery powered | 18650 Li-ion pack | Low-power battery camera, PIR wake-up |

**Power path:**

```
USB 5V → DCDC (3.3V/1.8V/1.2V) → SoC / DDR / Wi-Fi / Motor / IR LED
              └→ LDO (analog circuits: CMOS sensor, Audio Codec)
```

Notes:

- Motor startup draws high transient current — leave margin
- IR LED high current → independent MOSFET switch control
- Separate digital and analog grounds to avoid interference with audio and video

### 1.12 Enclosure and Mechanics

| Element              | Notes                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| Material             | ABS / PC+ABS (flammability rating V0)                                   |
| Thermal management   | SoC uses thermal paste + heatsink, or conducts heat through the housing |
| Dust protection      | Lens panel sealed to prevent dust adhesion                              |
| Waterproof (outdoor) | IP65/IP66 rating, O-ring seals                                          |
| Antenna placement    | Wi-Fi antenna away from motor and metal parts to avoid shielding        |
| TF card slot         | Hidden slot with eject mechanism                                        |
| Indicator light      | Status LED (blue/orange), can be turned off via command                 |

---

## 2. Software Architecture

### 2.1 Overall System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     App Layer / Cloud                        │
│        Mijia App    │  Xiaomi Cloud Storage │  IoT Platform  │
└────────────┬────────┴────────┬───────────────┴──────────────┘
             │ P2P (MISS)      │ HTTPS           │ MQTT
             │                 │                 │
┌────────────┴─────────────────┴─────────────────┴────────────┐
│                     Device Software Stack                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ MISS P2P │  │ Cloud    │  │ IoT     │  │  OTA Client │ │
│  │ SDK      │  │ Upload   │  │ SPEC    │  │             │ │
│  └────┬─────┘  └────┬─────┘  └────┬────┘  └──────┬──────┘ │
│       │              │             │               │        │
│  ┌────┴──────────────┴─────────────┴───────────────┴──────┐ │
│  │             Business Logic Layer (C/C++)                 │ │
│  │  Video Capture │ Encode Mgmt │ Storage Mgmt │ AI        │ │
│  │  Scheduler │ PTZ Control                                │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────────┐ │
│  │              Middleware / HAL Layer                       │ │
│  │  ISP Driver │ Encoder API │ Audio API │ GPIO │ Motor     │ │
│  │  NPU Driver                                              │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                  │
├───────────────────────────┴──────────────────────────────────┤
│                  Linux Kernel (4.9 / 5.x)                    │
│  V4L2 │ ALSA │ SPI │ I2C │ SDIO │ USB │ MTD │ NetFilter    │
├─────────────────────────────────────────────────────────────┤
│                    Bootloader (U-Boot)                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Operating System: Linux + Buildroot

**Why Linux:**

- Mature and stable, rich driver support
- Strong community support, chip vendors provide BSP (Board Support Package)
- Supports multi-threading/multi-processing, suitable for complex camera workloads
- Open source, customizable and tunable

**Buildroot build system:**

Buildroot is used to build a minimal embedded Linux root filesystem — lighter than Yocto and faster to build.

```bash
# Typical build flow
$ make <board>_defconfig    # Load board configuration
$ make menuconfig           # Configure kernel / userspace packages
$ make                      # Build, generating firmware

# Output artifacts
output/images/
├── u-boot.bin              # Bootloader
├── uImage                  # Linux kernel
├── rootfs.squashfs         # Read-only root filesystem
└── userdata.ubifs          # Writable data partition
```

**System tuning tips:**

- Remove unnecessary kernel modules (USB gadget, Bluetooth stack, etc.)
- Use BusyBox instead of full coreutils
- Choose musl libc over glibc (~2MB smaller)
- Disable kernel printk to reduce serial output overhead

### 2.3 Boot Process and Fast Boot Optimization

```
Power-on → BootROM → U-Boot → Kernel → Init → Application
│               │          │       │       │
│ (~10ms)       │(~500ms)  │(~2s)  │(~1s)  │(~2s)
└───────────────┴──────────┴───────┴───────┴────────  Total ~6s to first frame
```

**Fast boot optimizations:**

- U-Boot: skip unnecessary device detection, load kernel directly
- Kernel: trim unused drivers, use initramfs instead of init scripts
- Userspace: start ISP + encoder first, defer AI/P2P module loading
- Goal: **≤3 seconds from power-on to first video frame**

### 2.4 Flashing Tools

Firmware flashing happens during factory production:

| Method           | Notes                                             | Scenario                    |
| ---------------- | ------------------------------------------------- | --------------------------- |
| USB flashing     | PC connects via USB, uses chip vendor's tool      | Mass production             |
| SD card flashing | Put firmware on TF card, auto-flashes on power-up | Small batch / R&D           |
| UART flashing    | Serial + TFTP to download firmware                | Debugging / brick recovery  |
| Network flashing | Batch firmware delivery over network              | Large-scale production line |

**Production flashing workflow:**

```
Flash firmware → Write unique device info (DID/MAC/Key) → Functional self-test → Labeling and warehousing
```

Each device is provisioned with:

- **DID (Device ID)**: Unique device identifier on the Mijia platform
- **MAC address**: Physical address of the Wi-Fi module
- **Device key**: Used for secure communication with the Mijia cloud

### 2.5 MIKE: Xiaomi IPC Kit

Xiaomi provides a complete development kit **MIKE (Mi IPC Kit Environment)** for the camera ecosystem, covering the full chain from low-level chip adaptation to high-level business APIs:

```
                                              ┌─────────────────────────────┐
┌───────────────────────────────────────────┐ │                             │
│           MIKE Upper-layer API            │ │                             │
│  (Unified business interface: AV, AI,     │ │                             │
│   Storage, Provisioning, etc.)            │ │                             │
├───────────────────────────────────────────┤ │                             │
│           Middleware Modules              │ │      Tools Toolkit          │
│  ┌──────┐ ┌────┐ ┌─────┐ ┌────┐ ┌─────┐ │ │                             │
│  │ MISS │ │ OT │ │Cloud│ │Prov│ │Rec  │ │ │  Emulator (device emulator)  │
│  │(P2P) │ │Svc │ │Stor │ │    │ │     │ │ │  Monitor  (runtime monitor) │
│  └──────┘ └────┘ └─────┘ └────┘ └─────┘ │ │  Auto Test(automation test) │
│  ┌──────┐ ┌──────┐ ┌─────┐ ┌─────────┐ │ │  Logger Debugger            │
│  │ OTA  │ │Playbk│ │Codec│ │Local AI  │ │ │                             │
│  │      │ │      │ │     │ │NAS      │ │ │  Cross-layer tools:          │
│  └──────┘ └──────┘ └─────┘ └─────────┘ │ │  - Business-layer simulation│
├──────────────────────────────────────────┤ │  - Middleware unit testing   │
│      Chip Platform Adaptation Layer (HAL) │ │  - Platform HAL validation  │
│       SigmaStar │ Ingenic │ Others        │ └─────────────────────────────┘
└──────────────────────────────────────────┘
```

**MIKE module responsibilities:**

| Module                   | Description                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MISS (P2P)               | Streaming media transport SDK — handles audio/video and command channels between device and App                                                                    |
| OT Service               | Device heartbeat, online status management                                                                                                                         |
| Cloud Storage            | Encrypted segmented upload of event recordings                                                                                                                     |
| Provisioning             | Wi-Fi AP scan / BLE provisioning flow                                                                                                                              |
| Recording                | Local TF card recording management (continuous / event-based)                                                                                                      |
| OTA                      | Firmware upgrade (A/B partition, delta OTA)                                                                                                                        |
| Playback                 | Timeline playback of cloud / local recordings                                                                                                                      |
| Codec                    | Audio/video encode/decode wrapper (H.265/Opus)                                                                                                                     |
| Local AI                 | Human / face / pet / cry detection model inference scheduling                                                                                                      |
| NAS Storage              | LAN NAS video storage (SMB/NFS)                                                                                                                                    |
| Chip Platform Adaptation | Abstracts ISP/encoder/NPU differences across SoCs, provides unified HAL                                                                                            |
| Tools                    | Cross-layer dev/debug tools: Emulator (PC-side device sim), Monitor (runtime status), Auto Test (automation framework), Logger Debugger (log capture and analysis) |

MIKE's design allows business developers to work without worrying about underlying chip differences — they use the upper-layer API for feature development. The Tools toolkit also supports emulating device operation on a PC, significantly improving development and debugging efficiency.

### 2.6 P2P Module: MISS SDK

> The fundamentals of P2P (NAT types, UDP hole punching, STUN/TURN) are covered in [Introduction to P2P Technology](https://bitnpc.github.io/posts/p2p_intro/). Here we focus on the specific implementation in Xiaomi cameras.

**MISS (MIoT Streaming SDK)** is Xiaomi's P2P streaming transport SDK, implemented in C, cross-platform (device-side Linux + App-side iOS/Android), and is the core communication module in the MIKE kit.

#### Architecture Design

```
┌──────────────────────────────────────────┐
│         MISS SDK (Upper-layer API)        │
│  Create Channel │ Send Data │ Recv Data   │
│  Event Callback
├──────────────────────────────────────────┤
│         Channel Management / Scheduler    │
│  Connection Mgmt │ Reconnect Strategy     │
│  Flow Control │ QoS
├──────────────────────────────────────────┤
│       P2P Transport Layer (Pluggable)     │
│  ┌────────┐  ┌────────┐  ┌────────────┐ │
│  │  TUTK  │  │ Shangyun│  │ Xiaomi     │ │
│  │(Kalay) │  │         │  │ Self-Dev   │ │
│  │        │  │         │  │ P2P        │ │
│  └────────┘  └────────┘  └────────────┘ │
├──────────────────────────────────────────┤
│            Network Layer (UDP/TCP)        │
└──────────────────────────────────────────┘
```

#### P2P Connection Establishment

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│ Camera   │         │  P2P Server  │         │  App     │
└─────┬────┘         └──────┬───────┘         └─────┬────┘
      │  1. Register online  │                      │
      │──────────────────────►│                      │
      │                       │                      │
      │                       │   2. Query device    │
      │                       │   address            │
      │                       │◄─────────────────────│
      │                       │                      │
      │                       │   3. Return device   │
      │                       │   IP/port            │
      │                       │─────────────────────►│
      │                       │                      │
      │          4. NAT Traversal / P2P Direct       │
      │◄════════════════════════════════════════════►│
      │                                              │
      │    5. If P2P fails, relay via relay server   │
      │◄═══════════[ Relay Server ]═══════════════►│
```

#### Data Channel Types

MISS SDK supports multiplexing multiple logical channels over a single P2P connection:

| Channel         | Purpose                                | Characteristics                        |
| --------------- | -------------------------------------- | -------------------------------------- |
| Video channel   | Main / substream transport             | High bandwidth, frame drops acceptable |
| Audio channel   | Two-way talk audio                     | Low latency priority                   |
| Command channel | Control commands (PTZ, snapshot, etc.) | Reliable delivery                      |
| File channel    | Recording playback / download          | Reliable, supports resumable transfer  |
| Alert channel   | Event notifications                    | Low latency                            |

#### Why Multiple P2P Engines

The pluggable transport layer enables:

- **TUTK (Kalay)**: Covers global nodes, high connectivity overseas
- **Shangyun**: Dense node deployment in China, low latency
- **Xiaomi Self-Dev**: Full control, continuous optimization
- SDK automatically selects the optimal engine, transparent to the business layer

### 2.7 Provisioning Methods

Mijia cameras support two provisioning modes:

#### Wi-Fi AP Provisioning (Camera Scans QR Code)

```
┌───────────┐                              ┌───────────┐
│ Mijia App │                              │  Camera   │
└─────┬─────┘                              └─────┬─────┘
      │                                          │
      │  1. App generates QR code                │
      │     (Contains Wi-Fi SSID + Password      │
      │      + Token)                            │
      │     Displayed on phone screen            │
      │                                          │
      │                              2. Camera powered on,
      │                                 camera scans QR
      │                                 code on phone
      │                                          │
      │         3. Camera decodes QR code,       │
      │            extracts Wi-Fi credentials,   │
      │            connects to router            │
      │                                          │
      │  4. Camera connects to router,           │
      │     handshake with App via LAN/Cloud     │
      │◄────────────────────────────────────────►│
      │                                          │
      │  5. Bind device to Mijia account         │
      │─────────────(Cloud)────────────────────►│
```

Advantage: No extra hardware (Bluetooth chip) required — uses the camera's own capability for provisioning.

#### BLE + Wi-Fi Dual-Mode Provisioning

```
1. App discovers device via BLE
2. BLE channel sends Wi-Fi SSID + Password
3. Device connects to Wi-Fi
4. Binding completed via cloud
```

Advantage: Does not rely on the camera's image — works in dark or obstructed scenarios. Suitable for dual-mode Wi-Fi+BLE chip solutions.

### 2.8 Mijia IoT SPEC Integration

> The MIoT SPEC data model (Device → Service → Property/Action/Event) is architecturally very close to the Matter protocol's Cluster model. See [Introduction to Matter Protocol](https://bitnpc.github.io/posts/matter/) for a detailed comparison.

As a Mijia device, the camera must implement the Service/Property/Action/Event model defined by the MIoT SPEC protocol.

**Typical camera SPEC definition:**

```
Device: camera
├── Service: camera-control
│   ├── Property: on (bool)              — Camera power switch
│   ├── Property: night-shot (enum)      — Night vision mode (auto/on/off)
│   ├── Property: watermark (bool)       — Watermark toggle
│   ├── Action: start-recording          — Start recording
│   └── Action: stop-recording           — Stop recording
│
├── Service: ptz-control
│   ├── Property: pan-position (int)     — Pan angle
│   ├── Property: tilt-position (int)    — Tilt angle
│   ├── Action: rotate (direction, speed)— Rotate
│   └── Action: go-to-preset (id)       — Go to preset position
│
├── Service: motion-detection
│   ├── Property: sensitivity (enum)     — Sensitivity (low/medium/high)
│   ├── Property: detection-area (struct)— Detection zone
│   └── Event: motion-detected           — Motion detection event
│
├── Service: ai-detection
│   ├── Property: human-detect-on (bool) — Human detection toggle
│   ├── Property: face-detect-on (bool)  — Face detection toggle
│   ├── Property: pet-detect-on (bool)   — Pet detection toggle
│   ├── Property: cry-detect-on (bool)   — Cry detection toggle
│   ├── Event: human-detected            — Human detection event
│   ├── Event: face-detected             — Face detection event
│   ├── Event: pet-detected              — Pet detection event
│   └── Event: cry-detected              — Cry detection event
│
├── Service: storage
│   ├── Property: sd-card-status (enum)  — TF card status
│   ├── Property: cloud-storage-on (bool)— Cloud storage toggle
│   └── Action: format-sd-card           — Format TF card
│
└── Service: indicator-light
    └── Property: on (bool)              — Indicator light toggle
```

The device maintains a persistent connection with the Xiaomi IoT cloud via **MQTT**, reporting property changes and events. Control commands issued by the App are also delivered through the MQTT → device path.

### 2.9 Cloud Storage

> The video segmentation and playback mechanism of cloud storage shares design concepts with the HLS protocol (splitting video into small segments + index manifest). See [HLS and Streaming Media Storage](https://bitnpc.github.io/posts/hls_intro/) for details.

Xiaomi cloud storage uploads recording segments from the camera to the cloud, allowing users to view them in the App.

#### Upload Pipeline

```
Camera side:
  ISP → YUV420 → Encoder (H.265, 20fps) → Ring buffer → Event trigger → Segment (10s each) → HTTPS upload

Upload flow:
  1. Event triggers (motion detection / AI detection / user manual)
  2. Extract video segments before and after the event from the ring buffer
  3. Encrypt segments (AES-128)
  4. Upload via HTTPS POST to Xiaomi cloud storage
  5. Server returns index info, device reports event metadata

Playback flow:
  App requests timeline → Cloud returns segment list → App pulls stream via HTTPS → Decrypt and play
```

#### Key Design Decisions

- **Ring buffer**: Keeps the most recent 10~30 seconds of video in memory, ensuring event-triggered capture can reach back before the event
- **End-to-end encryption**: Video is encrypted on the device; the cloud cannot decrypt it — the user-side key handles decryption
- **Resumable upload**: Automatically retries unfinished segments during network fluctuations
- **Flow control**: Dynamically adjusts upload bitrate (substream/main stream) based on available bandwidth

### 2.10 AI Algorithms

#### Algorithm Capability Matrix

| Algorithm        | Input                           | Inference Hardware | Frame Rate             | Description                           |
| ---------------- | ------------------------------- | ------------------ | ---------------------- | ------------------------------------- |
| Human detection  | Video frame (substream 640x360) | NPU                | 10~15fps               | Detects if people are in the frame    |
| Face recognition | Cropped human region            | NPU                | On-demand              | Recognizes strangers / family members |
| Pet detection    | Video frame                     | NPU                | 10~15fps               | Cat / dog detection                   |
| Cry detection    | Audio frame (16kHz PCM)         | CPU/DSP            | Real-time              | Baby cry recognition                  |
| Motion detection | Frame differencing              | CPU                | Main stream frame rate | Low-computation basic detection       |

#### Deployment Pipeline

```
Model training (cloud GPU)
    │
    ▼ Model quantization / conversion (float → INT8)
    │
    ▼ Chip vendor toolchain conversion (ONNX → chip-private format)
    │  - SigmaStar: IPU Toolkit → .img model
    │  - Ingenic: Magik → .bin model
    │
    ▼ Model files packaged into firmware data partition
    │
    ▼ Device-side NPU Runtime loads and runs inference
```

#### AI Pipeline

```
ISP outputs YUV frame
    │
    ├──► Main stream encode (1080P/1296P) ──► P2P / Recording
    │
    └──► Substream (360P/VGA) ──► AI preprocessing (Resize/Normalize)
                                    │
                                    ▼
                              NPU inference (human / pet)
                                    │
                                    ▼
                              Post-processing (NMS / threshold filtering)
                                    │
                                    ├──► Target detected → trigger event report + cloud storage
                                    ├──► Face region → crop → face recognition model
                                    └──► No target → wait for next frame
```

**Audio AI (cry detection)** runs independently of the video pipeline in the audio thread:

```
MIC → ADC → 16kHz PCM → Sliding window framing → Feature extraction (MFCC) → Classification model → Cry / not cry
```

### 2.11 OTA (Over-the-Air Update)

OTA is the foundation for continuous iteration of smart devices, requiring both safety and reliability during the upgrade process.

#### OTA Flow

```
┌───────────┐         ┌──────────────┐         ┌───────────┐
│ Xiaomi    │         │   Camera     │         │ Mijia App │
│ OTA Server│         │              │         │           │
└─────┬─────┘         └──────┬───────┘         └─────┬─────┘
      │                      │                       │
      │  1. Check for updates (scheduled / push)      │
      │◄─────────────────────│                       │
      │                      │                       │
      │  2. Return new version info + download URL   │
      │─────────────────────►│                       │
      │                      │                       │
      │  3. Download firmware package (HTTPS)        │
      │─────────────────────►│                       │
      │                      │                       │
      │               4. Verify firmware signature   │
      │                  (RSA/ECDSA)                 │
      │                      │                       │
      │               5. Write to standby partition   │
      │                  (A/B)                       │
      │                      │                       │
      │               6. Switch boot partition,      │
      │                  reboot                      │
      │                      │                       │
      │               7. Boot successful → report    │
      │                  new version                 │
      │◄─────────────────────│                       │
      │                      │                       │
      │                      │  8. App shows upgrade │
      │                      │  complete             │
      │                      │──────────────────────►│
```

#### Brick Prevention Strategy

| Mechanism           | Description                                                                      |
| ------------------- | -------------------------------------------------------------------------------- |
| A/B dual partition  | New firmware written to standby partition; switch occurs only after verification |
| Watchdog            | Hardware watchdog triggers rollback if system fails to run after boot            |
| Boot counter        | Rollback to old partition after N consecutive boot failures                      |
| Firmware signature  | RSA/ECDSA signature verification prevents tampering                              |
| Power-loss recovery | Power loss during write does not affect the currently running partition          |

#### Delta OTA

To save bandwidth and upgrade time, delta OTA is supported:

- Server generates a delta package from old and new firmware using bsdiff (typically 10%~30% of full package size)
- Device applies the delta against the current partition data to reconstruct the full new firmware
- Verifies hash integrity, then writes

---

## 3. Audio/Video Pipeline Deep Dive

### 3.1 Video Capture and Encoding

> For the basics of audio/video digitization (sampling, quantization, encoding, color spaces), see [Audio/Video and Its Digital Representation](https://bitnpc.github.io/posts/av_into/).

```
Light → Lens → CMOS Sensor → ISP → Encoder → Bitstream output

ISP Pipeline:
  Raw Bayer → Black level correction → Bad pixel correction → Demosaic → White balance →
  Color correction → Gamma → Noise reduction (2D/3D-DNR) → Sharpening → YUV output
```

Mainstream Xiaomi cameras use **YUV420** color space (see [Audio/Video Fundamentals](https://bitnpc.github.io/posts/av_into/#2-%E4%BB%80%E4%B9%88%E6%98%AF-yuv420-%E8%89%B2%E5%BD%A9%E7%A9%BA%E9%97%B4) for a detailed explanation), **H.265** video encoding, **Opus** audio encoding, and a video frame rate of **20fps**.

**Multi-stream design:**

| Stream      | Resolution            | Color Space | Frame Rate | Codec | Bitrate      | Purpose                                               |
| ----------- | --------------------- | ----------- | ---------- | ----- | ------------ | ----------------------------------------------------- |
| Main stream | 1920x1080 / 2304x1296 | YUV420      | 20fps      | H.265 | 1~4 Mbps     | P2P HD viewing, cloud storage                         |
| Substream   | 640x360               | YUV420      | 15fps      | H.265 | 200~500 Kbps | P2P smooth viewing (weak network), AI inference input |
| JPEG stream | 1920x1080             | —           | On-demand  | JPEG  | —            | Snapshots, cover images                               |

### 3.2 Audio Capture and Processing

```
MIC → ADC (16kHz/16bit) → AEC (Echo Cancellation) → ANR (Noise Reduction) → AGC (Gain Control) → Encode (Opus)
```

Audio encoding uses **Opus**, an open-source, royalty-free codec supporting everything from low-bitrate speech (6kbps) to high-bitrate music (510kbps), with encoding latency as low as 5ms — ideal for real-time two-way talk.

- **AEC (Acoustic Echo Cancellation)**: Essential for two-way talk scenarios — eliminates speaker echo
- **ANR (Automatic Noise Reduction)**: Removes ambient background noise
- **AGC (Automatic Gain Control)**: Automatically adjusts gain to prevent levels from being too high or too low

### 3.3 Local Storage (TF Card Recording)

```
Recording strategies:
  ├── Continuous recording: 7x24 loop recording, overwrites oldest files when full
  └── Event recording: Records only when events are detected, saves space

File organization:
  /mnt/sdcard/record/
  ├── 2024/11/10/
  │   ├── 14/            # Organized by hour
  │   │   ├── 00.mp4     # One file per minute
  │   │   ├── 01.mp4
  │   │   └── ...
  │   └── 15/
  └── index.db           # SQLite index for timeline queries
```

---

## 4. Production and Testing

### 4.1 Factory Test Items

| Test              | Method                                        | Criteria                             |
| ----------------- | --------------------------------------------- | ------------------------------------ |
| Video image       | Align to standard color card, auto-analyze    | Color/contrast/clarity meets spec    |
| IR night vision   | Darkroom environment, check IR LED brightness | Even illumination, no dark corners   |
| PTZ movement      | Full-range rotation, check step count         | Positioning accuracy ≤1°, no jamming |
| Microphone        | Play standard audio source, check recording   | SNR ≥ 40dB                           |
| Speaker           | Play test audio                               | No distortion, volume meets spec     |
| Wi-Fi             | Connect to specified AP, test throughput      | ≥ 10Mbps                             |
| TF card slot      | Insert test card, read/write verification     | Speed ≥ 10MB/s                       |
| Button / Reset    | Press to test                                 | GPIO level transitions correctly     |
| Power consumption | Measure current across scenarios              | Standby <2W, active <5W              |

### 4.2 Reliability Testing

| Test                    | Conditions                        | Requirements                                |
| ----------------------- | --------------------------------- | ------------------------------------------- |
| High-temperature aging  | 50°C continuous operation for 48h | No crashes, no image anomalies              |
| Low-temperature startup | -10°C cold start                  | Normal image output                         |
| Voltage fluctuation     | 4.5V ~ 5.5V                       | Stable operation                            |
| Power-loss test         | Random power cuts 1000 times      | System boots normally, filesystem undamaged |
| Wi-Fi roaming           | Signal attenuation / recovery     | Auto-reconnect, P2P recovery                |
| Long-term run           | Continuous operation for 30 days  | No memory leaks, services stay alive        |

---

## 5. Summary

An industrial-grade Mijia camera product spans a wide range of technology stacks, from hardware to software to the cloud:

```
Hardware: SoC selection → Sensor → Optics → Mechanical → Power → RF
Software: OS/BSP → ISP tuning → Encoding → P2P → AI → IoT → OTA
Cloud: Provisioning → Device management → Cloud storage → Push notifications → OTA distribution
Production: Flashing → Key writing → Automated testing → Burn-in → Packaging
```

The core challenge is: within limited hardware resources (a few hundred MHz CPU + ~100MB of RAM), simultaneously running video capture and encoding, AI inference, P2P transport, cloud storage upload, IoT communication, and other real-time tasks — all while maintaining 7x24 stable operation. This demands fine-grained resource scheduling, strict memory management, and robust exception recovery mechanisms.

This article ties together the technical knowledge introduced across previous blog posts into a complete product scenario:

- [Audio/Video Digitization](https://bitnpc.github.io/posts/av_into/) — Sampling, YUV420, H.265 encoding applied to the camera's video capture and encoding pipeline
- [P2P Technology](https://bitnpc.github.io/posts/p2p_intro/) — NAT traversal applied to MISS SDK's multi-engine P2P architecture
- [HLS Streaming](https://bitnpc.github.io/posts/hls_intro/) — Segment-based storage applied to cloud storage slice upload and timeline playback
- [Matter Protocol](https://bitnpc.github.io/posts/matter/) — Device model applied to Mijia IoT SPEC's Service/Property/Action design

---

References

- [Xiaomi IoT Developer Platform](https://iot.mi.com/v2/new/doc/introduction/knowledge/spec)
- [SigmaStar Official Site](https://www.sigmastar.com.cn)
- [Ingenic Official Site](https://www.ingenic.com.cn)
- [Buildroot Official Documentation](https://buildroot.org/docs.html)
