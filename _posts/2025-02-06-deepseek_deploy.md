---
layout: post
title: "使用 Ollama 本地部署 Deepseek 并集成到 VSCode 中"
date: 2024-09-06
categories: [技术, 大模型]
tags: 
    - Ollama
    - Deepseek
---


## 什么是 Ollama 和 DeepSeek？
Ollama
Ollama 是一个用于本地部署和管理 AI 模型的工具。它允许开发者在本地环境中运行各种 AI 模型，而无需依赖云端服务。Ollama 提供了简单的命令行接口，使得模型的部署和管理变得非常容易。

DeepSeek
DeepSeek 是一个基于 AI 的代码补全工具，它能够根据上下文提供智能的代码建议。DeepSeek 支持多种编程语言，并且可以通过 API 集成到各种开发环境中，如 VSCode、IntelliJ IDEA 等。


## 在 macOS 上使用 Ollama 部署 DeepSeek
首先，我们需要在 macOS 上安装 Ollama。Ollama 可以通过 Homebrew 进行安装。

```bash
brew install ollama
```

下载 Deepseek 模型
访问 ollama 的 [deepseek library](https://ollama.com/library/deepseek-r1)
选择模型，执行对应的命令。这里使用的是 7b 的默认版本.
![Deepseek](/assets/img/post/post-2025-02-06/deepseek.png){: width="972" height="589" .w-100 .normal}

```bash
ollama run deepseek-r1
```
运行成功后就可以对话了。

![Deepseek_run](/assets/img/post/post-2025-02-06/deepseek_run.png){: width="972" height="589" .w-100 .normal}

## 在 VSCode 中集成 DeepSeek

### 集成本地模型
执行如下命令，先把本地模型的 server 跑起来
```bash
ollama serve
```
在 VSCode 的插件库中搜索 Continue，安装后 connect 至本地的 Deepseek 模型即可。



![Deepseek_chat](/assets/img/post/post-2025-02-06/deepseek_chat.png){: width="972" height="589" .w-100 .normal}

### 集成在线模型
在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys)申请 API key，然后在 VSCode 中添加对应的 key 即可。

![Deepseek_add](/assets/img/post/post-2025-02-06/deepseek_add.png){: width="972" height="589" .w-100 .normal}
