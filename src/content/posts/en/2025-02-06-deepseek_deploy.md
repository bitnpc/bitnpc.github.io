---
title: 'Deploy Deepseek Locally with Ollama and Integrate into VSCode'
pubDate: 2024-09-06
categories: [Tech, LLM]
tags: 
    - Ollama
    - Deepseek
toc: true
description: 'Run DeepSeek locally on macOS with Ollama and connect it to VSCode via the Continue extension for AI-assisted coding.'
---


## What are Ollama and DeepSeek?

**Ollama**
Ollama is a tool for locally deploying and managing AI models. It allows developers to run various AI models in their local environment without relying on cloud services. Ollama provides a simple command-line interface that makes model deployment and management very easy.

**DeepSeek**
DeepSeek is an AI-powered code completion tool that provides intelligent code suggestions based on context. DeepSeek supports multiple programming languages and can be integrated into various development environments, such as VSCode, IntelliJ IDEA, etc., through its API.


## Deploy DeepSeek with Ollama on macOS

First, we need to install Ollama on macOS. Ollama can be installed via Homebrew.

```bash
brew install ollama
```

**Download the DeepSeek Model**

Visit Ollama's [DeepSeek library](https://ollama.com/library/deepseek-r1)

Select the model and run the corresponding command. Here we use the default 7b version.

![Deepseek](../../../assets/images/posts/post-2025-02-06/deepseek.png)

```bash
ollama run deepseek-r1
```

Once it's running successfully, you can start chatting.

![Deepseek_run](../../../assets/images/posts/post-2025-02-06/deepseek_run.png)

## Integrate DeepSeek into VSCode

### Integrate the Local Model

Run the following command to start the local model server:

```bash
ollama serve
```

Search for Continue in the VSCode extension marketplace, install it, and then connect to the local Deepseek model.

![Deepseek_chat](../../../assets/images/posts/post-2025-02-06/deepseek_chat.png)

### Integrate the Online Model

Request an API key from the [DeepSeek Open Platform](https://platform.deepseek.com/api_keys), then add the corresponding key in VSCode.

![Deepseek_add](../../../assets/images/posts/post-2025-02-06/deepseek_add.png)
