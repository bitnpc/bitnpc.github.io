---
layout: post
title: "在 macOS 上部署 ComfyUI"
date: 2024-03-13
categories: [技术, 大模型]
tags: 
    - 大模型
    - Stable Diffusion
---

`ComfyUI` 是一个强大且模块化的 `Stable Diffusion` 图形用户界面（GUI）和后端工具。它提供了一个基于图形、节点和流程图的界面，让您能够设计和执行复杂的稳定扩散工作流程。它有以下特点和功能:
1. 节点/图形/流程图界面：您可以在不需要编写代码的情况下实验和创建复杂的稳定扩散工作流程。
2. 全面支持：`ComfyUI` 支持 SD1.x、SD2.x、SDXL、稳定视频扩散和稳定级联。
3. 异步队列系统：优化的队列系统仅重新执行工作流中发生更改的部分。
4. 低 VRAM 支持：使用 `--lowvram` 选项，即使在 VRAM 少于 3GB 的 GPU 上也可以运行（在 VRAM 较低的 GPU 上会自动启用）。
5. 离线工作：`ComfyUI` 完全离线工作，不会下载任何内容。
6. 模型支持：可以加载 `ckpt`、`safetensors` 和 `diffusers` 模型/检查点，以及独立的 `VAE` 和 `CLIP` 模型。
7. 工作流保存/加载：您可以将工作流保存为 JSON 文件，并从生成的 PNG 文件中加载完整的工作流（包括种子）。

我们可以使用 `ComfyUI`

本机环境:
- M1 Pro MacBook
- 16G RAM
- 256G ROM
- macOS Sonama 14.4 (23E214)

# python 环境
macOS 自带 python3，为了避免执行命令时手动替换，需要处理一下。
```bash
$ vim ~/.zshrc
// 添加如下三行
export PATH="/Users/tony/Library/Python/3.9/bin:$PATH"
alias python='python3'
alias pip='pip3'
$ source ~/.zshrc
```

# torch 工具
```bash
$ pip install --pre torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/nightly/cpu
```

# 代码仓库和模型
代码仓库地址：[https://github.com/comfyanonymous/ComfyUI.git](https://github.com/comfyanonymous/ComfyUI.git)

把模型放在 **models/checkpoints** 目录

切换到 `ComfyUI` 目录，安装依赖

```bash
$ pip install -r requirements.txt
```

安装的时候会报如下错误。
```
/Users/tony/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: 
NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, 
currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. 
See: https://github.com/urllib3/urllib3/issues/3020
```

这说明 openssl 的编译版本有问题，需要把 LibreSSL 降级
```bash
$ openssl version
LibreSSL 3.3.6
$ pip install urllib3==1.26.6
```

# 运行
```bash
$ python main.py --force-fp16
Total VRAM 16384 MB, total RAM 16384 MB
Forcing FP16.
Set vram state to: SHARED
Device: mps
VAE dtype: torch.float32
Using sub quadratic optimization for cross attention, if you have memory or speed issues try using: --use-split-cross-attention
Starting server

To see the GUI go to: http://127.0.0.1:8188
```
![ComfyUI](/assets/img/post/post-2024-03-13/comfyUI.png){: width="972" height="589" .w-100 .normal}


参考资料
1. [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI.git)
2. [Accelerated PyTorch training on Mac](https://developer.apple.com/metal/pytorch/)
3. [ImportError: urllib3 v2.0 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with LibreSSL 2.8.3](https://stackoverflow.com/questions/76187256/importerror-urllib3-v2-0-only-supports-openssl-1-1-1-currently-the-ssl-modu)