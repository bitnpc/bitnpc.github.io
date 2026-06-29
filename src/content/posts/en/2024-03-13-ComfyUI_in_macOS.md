---
title: 'Deploying ComfyUI on macOS'
pubDate: 2024-03-13
categories: [Tech, Large Language Models]
tags: 
    - Large Language Models
    - Stable Diffusion
toc: true
description: 'A guide to installing and running ComfyUI on Apple Silicon Mac, including Python setup, PyTorch, dependencies, and troubleshooting.'
---

`ComfyUI` is a powerful and modular `Stable Diffusion` graphical user interface (GUI) and backend tool. It provides a graph/nodes/flowchart-based interface that lets you design and execute complex Stable Diffusion workflows without writing code. Here are its features and capabilities:

1. Node/graph/flowchart interface: Experiment with and create complex Stable Diffusion workflows without writing any code.
2. Comprehensive support: `ComfyUI` supports SD1.x, SD2.x, SDXL, Stable Video Diffusion, and Stable Cascade.
3. Asynchronous queue system: The optimized queue system only re-executes the parts of the workflow that have changed.
4. Low VRAM support: With the `--lowvram` option, it can run even on GPUs with less than 3GB of VRAM (automatically enabled on low-VRAM GPUs).
5. Offline operation: `ComfyUI` works entirely offline and does not download anything.
6. Model support: Can load `ckpt`, `safetensors`, and `diffusers` models/checkpoints, as well as standalone `VAE` and `CLIP` models.
7. Workflow save/load: You can save workflows as JSON files and load complete workflows (including seeds) from generated PNG files.

We can use `ComfyUI` to easily generate images.

Local environment:
- 16-inch MacBook Pro (Apple Silicon M1 Pro)
- 16GB unified memory
- 512GB SSD
- macOS Sonoma 14.4 (23E214)

## Python Environment
macOS comes with Python 3 pre-installed. To avoid having to manually type `python3` every time, let's set up some aliases.

```bash
$ vim ~/.zshrc
// Add the following three lines
export PATH="/Users/tony/Library/Python/3.9/bin:$PATH"
alias python='python3'
alias pip='pip3'
$ source ~/.zshrc
```

## PyTorch
```bash
$ pip install --pre torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/nightly/cpu
```

## Repository and Models
Repository URL: [https://github.com/comfyanonymous/ComfyUI.git](https://github.com/comfyanonymous/ComfyUI.git)

Place models in the **models/checkpoints** directory.

Switch to the `ComfyUI` directory and install dependencies:

```bash
$ pip install -r requirements.txt
```

During installation, you may encounter the following error:
```
/Users/tony/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35:
NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+,
currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'.
See: https://github.com/urllib3/urllib3/issues/3020
```

This indicates an OpenSSL compilation issue — you'll need to downgrade urllib3:

```bash
$ openssl version
LibreSSL 3.3.6
$ pip install urllib3==1.26.6
```

## Running
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
![ComfyUI](../../../assets/images/posts/post-2024-03-13/comfyUI.png)
```alert
type: warning
description: macOS Ventura can generate images normally. On macOS Sonoma 14.4 (23E214), GPU acceleration may fail, resulting in solid-color images. You can work around this by adding the `-cpu` parameter, though this will slow down image generation.
```

## References
1. [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI.git)
2. [Accelerated PyTorch training on Mac](https://developer.apple.com/metal/pytorch/)
3. [ImportError: urllib3 v2.0 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with LibreSSL 2.8.3](https://stackoverflow.com/questions/76187256/importerror-urllib3-v2-0-only-supports-openssl-1-1-1-currently-the-ssl-modu)
4. [ComfyUI outputs Rothko-esque solid color images](https://github.com/comfyanonymous/ComfyUI/issues/2992)
