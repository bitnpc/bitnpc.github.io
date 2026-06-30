---
title: 'macOS 开发环境配置'
pubDate: 2014-07-01
categories: [macOS]
tags:
    - Homebrew
    - Shell
    - Git
toc: true
description: '第一次配置或重装后的 macOS 环境时，最容易踩坑的地方集中在工具链版本、安装路径与权限控制。本文按「系统准备 → 包管理 → 终端与 Shell → 语言运行时 → 版本控制 → 容器与常用工具」的顺序整理一套通用流程，确保后续开发工作可快速投入。'
---

## 概述
第一次配置或重装后的 macOS 环境时，最容易踩坑的地方集中在工具链版本、安装路径与权限控制。本文按「系统准备 → 包管理 → 终端与 Shell → 语言运行时 → 版本控制 → 容器与常用工具」的顺序整理一套通用流程，确保后续开发工作可快速投入。

> **一键自动化**：本文对应的自动化脚本已整理至 [bitnpc/mac-dev-setup](https://github.com/bitnpc/mac-dev-setup)，执行 `make all` 即可完成全部配置。下文各节均有对应的 Makefile 目标与 Shell 脚本，适合对照阅读。
>

## 环境准备
- **系统更新**：建议先升级至最新稳定版 macOS（`设置 → 通用 → 软件更新`），同步更新安全补丁。
- **磁盘与权限**：在「系统设置 → 隐私与安全性」中为终端、开发工具开启完全磁盘访问，以避免安装时频繁弹窗。
- **命令行工具检查**：通过 `xcode-select --install` 安装 Command Line Tools；若已安装，可使用 `xcode-select --print-path` 检查路径是否指向预期位置。

## Xcode 与 Command Line Tools
iOS/macOS App 开发必备，最新版本可从 [**App Store**](https://apps.apple.com/cn/app/xcode/id497799835?mt=12) 下载，历史版本在 [**开发者中心**](https://developer.apple.com/download/applications/) 获取。
```alert
type: success
description: 即便不开发 App，也推荐安装 Xcode Command Line Tools，它提供 clang、git 等基础工具，许多第三方依赖都默认依赖于此。
```

### 常用命令
```bash
# 当前系统使用的默认 Xcode 路径
xcode-select --print-path

# 多版本切换
sudo xcode-select -switch /Applications/Xcode.app/Contents/Developer

# 仅安装 Command Line Tools
xcode-select --install
```

自动化对应：`make bootstrap` → `scripts/bootstrap.sh`

## Homebrew
[**Homebrew**](https://brew.sh/) 是 macOS 上事实上的标准包管理器，负责 CLI 工具与 GUI 应用的安装、升级与卸载，是整套环境自动化维护的核心。

### 安装与卸载
```bash
# 安装（Intel 与 Apple Silicon 通用）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 卸载
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
```

安装完成后，按照脚本提示将 `brew shellenv` 注入当前 Shell，例如：
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Brewfile 与自动化
推荐使用 Brewfile 集中管理所有依赖。`Brewfile` 是整套环境的**唯一包清单**，CLI 工具、GUI 应用、字体均在其中声明。

```bash
# 导出当前依赖为 Brewfile
brew bundle dump --describe

# 按 Brewfile 安装依赖
brew bundle install
```

自动化对应：`make brew` → `scripts/install_brew_bundle.sh`

### 常见问题
- **镜像源切换**：国内推荐使用清华 / 中科大镜像，安装前设置 `HOMEBREW_BREW_GIT_REMOTE` 与 `HOMEBREW_CORE_GIT_REMOTE`，或使用社区脚本批量替换。
- **权限不足**：Apple Silicon 默认安装在 `/opt/homebrew`；Intel 机器可使用 `sudo chown -R $(whoami) /usr/local/*` 修复早年遗留权限。
- **环境变量残留**：重装或迁移后，清理 `~/.bash_profile` 与 `~/.zprofile` 中旧的 `brew shellenv`，防止指向失效路径。

参考链接：
- [Homebrew 中文主页](https://brew.sh/index_zh-cn.html)
- [USTC Homebrew 镜像说明](https://mirrors.ustc.edu.cn/help/homebrew.git.html)
- [清华 Homebrew 镜像说明](https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/)

## 终端与 Shell
macOS 自带 Terminal 功能有限，推荐搭配 iTerm2、Oh My Zsh、Starship 与常用插件打造高效终端环境。

自动化对应：`make shell` → `scripts/setup_shell.sh`

### iTerm2
```bash
brew install --cask iterm2
```

### Shell 配置
```bash
# 安装 Oh My Zsh（已安装则跳过）
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# 将 zsh 设为默认 Shell
chsh -s /bin/zsh

# 安装常用插件（自动补全 / 高亮）
brew install zsh-autosuggestions zsh-syntax-highlighting

# 安装 Starship 跨 Shell 提示符
brew install starship

# 追加到 ~/.zshrc
cat <<'EOF' >> ~/.zshrc
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
eval "$(starship init zsh)"
EOF
```
```alert
type: info
description: 可以使用 chezmoi 管理 dotfiles（`make chezmoi`），`chezmoi/` 目录下提供了完整的 `~/.zshrc`、`~/.zprofile` 模板，支持条件渲染与变量注入。
```

## Python 环境
macOS 自带的系统 Python 版本较旧，建议使用 `pyenv` 管理多版本。

自动化对应：`setup_languages.sh`（作为 `make languages` 的一部分）

```bash
# 安装 pyenv 及虚拟环境插件
brew install pyenv pyenv-virtualenv pipx

# 初始化（注意 pyenv 需要同时在 .zprofile 和 .zshrc 中放入 hook）
echo 'eval "$(pyenv init --path)"' >> ~/.zprofile
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zprofile

# 安装指定版本（默认 3.11.6）
pyenv install 3.11.6
pyenv global 3.11.6

# （可选）创建虚拟环境
pyenv virtualenv 3.11.6 project-env
pyenv activate project-env
```

常用辅助工具：
- `pipx`：隔离安装 CLI 工具（示例：`pipx install httpie`）；
- `poetry` / `pipenv`：管理项目依赖与虚拟环境；
- `uv`：快速创建虚拟环境与安装依赖，兼容 pip/virtualenv 的新选择；
- 在 `~/.zshrc` 中设置 `export PIP_REQUIRE_VIRTUALENV=true` 可避免误安装到全局环境。

## Ruby 环境
推荐使用轻量级版本管理器 [**rbenv**](https://github.com/rbenv/rbenv)，避免注入过多 Shell Hook。如需在多语言间统一管理，可考虑 [`asdf`](https://asdf-vm.com/) 搭配 `.tool-versions` 文件。

自动化对应：`setup_languages.sh`（作为 `make languages` 的一部分）

```bash
# 安装 rbenv 与 ruby-build（ruby-build 提供 install 子命令）
brew install rbenv ruby-build

# 初始化
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc

# 安装指定版本（默认 3.2.2，注意需要指定 OpenSSL 路径以适配 Apple Silicon）
RUBY_VERSION=3.2.2
rbenv install $RUBY_VERSION --with-openssl-dir=$(brew --prefix openssl@3)
rbenv global $RUBY_VERSION

# 安装常用 gem
gem install bundler cocoapods
```

## Node.js 环境
推荐使用 [**Volta**](https://volta.sh/)，它在 Apple Silicon 上体验较好，能自动在项目 `package.json` 中锁定版本。

自动化对应：`setup_languages.sh`（作为 `make languages` 的一部分）

```bash
# 安装 Volta
brew install volta

# Volta 自动注册到 PATH（需要在 ~/.zshrc 或 ~/.zprofile 中初始化）
# 重新加载 shell 后安装 node/npm
volta install node@20
volta install pnpm
```

Volta 会把选定版本固定在全局，同时允许在项目目录的 `package.json` 中用 `volta` 字段声明覆盖版本。切换项目目录时自动切换运行时版本，无需手动 `nvm use`。

常见工具链：
- 包管理器：`npm`、`yarn`、`pnpm`，开启 `corepack enable` 统一管理；
- 格式化与 Lint：将 `eslint`、`prettier`、`typescript` 写入项目 `devDependencies`，通过 `npx` 调用；
- Monorepo：可选 `turbo`、`nx` 或 `lage`，先用 `volta pin` 固定版本。

## 其他语言运行时
自动化对应：`setup_languages.sh`（作为 `make languages` 的一部分）

```bash
# Go
brew install go
mkdir -p $HOME/go/bin
# 在 ~/.zshrc 中添加：
# export GOPATH=$HOME/go
# export GOBIN=$HOME/go/bin
# export PATH=$GOBIN:$PATH

# Rust
brew install rustup-init
rustup-init -y --no-modify-path
rustup component add rustfmt clippy
```
```alert
type: success
description: **版本覆写**：以上语言运行时的默认版本定义在 `scripts/setup_languages.sh` 顶部（如 `PYTHON_VERSION=3.11.6`、`RUBY_VERSION=3.2.2`、`NODE_VERSION=20`），可通过环境变量在运行前临时修改：`NODE_VERSION=22 make languages`。
```

## Git 与 SSH 双重身份配置
企业开发通常需要同时维护**公司内部身份**（GitLab / 自建 Git 服务）和**个人身份**（GitHub），二者的用户名、邮箱、SSH 密钥各不相同。本节提供一套可自动化部署的**双重身份方案**，基于 Git 的 `init.templateDir` 机制实现按仓库自动切换。

自动化对应：`make git` → `scripts/setup_git.sh`

### 基础配置
```bash
brew install git gh glab

# 全局默认身份 — 公司身份
git config --global user.name "Your Name"
git config --global user.email "your@company.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input
git config --global pull.rebase false
```

### GitHub 身份自动切换

核心思路：利用 Git 的 `init.templateDir` 在每次 `git clone` 时注入 `post-checkout` hook，在首次 checkout 后自动检测远程仓库是否为 `github.com`，若是则将 GitHub 身份追加为本地配置。

```bash
# 1. 创建独立的 GitHub 身份配置
cat > ~/.gitconfig-github <<EOF
[user]
  name = your-github-username
  email = your-github@email.com
EOF

# 2. 设置 init.templateDir
git config --global init.templateDir ~/.git-template/hooks/

# 3. 创建 post-checkout hook
mkdir -p ~/.git-template/hooks
cat > ~/.git-template/hooks/post-checkout <<'HOOK'
#!/bin/zsh
# 仅在首次 clone checkout 时执行（SHA1 为全 0）
if [[ "$1" = "0000000000000000000000000000000000000000" ]]; then
  remote=$(git remote get-url origin 2>/dev/null)
  if echo "$remote" | grep -q "github.com"; then
    git config include.path ~/.gitconfig-github
    echo "✅ GitHub identity applied for $(basename $(git rev-parse --show-toplevel))"
  fi
fi
HOOK
chmod +x ~/.git-template/hooks/post-checkout
```

此后所有 `git clone` 的仓库无需额外操作，GitHub 仓库自动使用独立身份，公司仓库使用全局默认身份。
```alert
type: success
description: 对于已存在本地仓库，可用 `git config include.path ~/.gitconfig-github` 手动追加。
```

### SSH 密钥
```bash
# 生成默认密钥
ssh-keygen -t ed25519 -C "your@company.com"

# 生成 GitHub 专用密钥（不覆盖默认密钥）
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "your-github@email.com"

# 添加到 ssh-agent（Apple Silicon 支持 --apple-use-keychain）
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
ssh-add --apple-use-keychain ~/.ssh/id_ed25519_github
```

### SSH 配置
```bash
cat > ~/.ssh/config <<EOF
Host *
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
EOF
```

建议同步配置：
- 使用 `gh auth login` 登录 GitHub CLI；
- 启用 `AddKeysToAgent yes` 结合 `ssh-add --apple-use-keychain` 避免重复输入密码。

## 容器与虚拟化
自动化对应：`make containers` → `scripts/setup_containers.sh`

```bash
# Colima（轻量 Docker 运行时，Apple Silicon 推荐）
brew install docker
colima start --arch aarch64 --runtime docker --vm-type=vz --mount-type=virtiofs --memory 4 --cpu 4

# Podman Desktop（含 CLI，不依赖 Docker Desktop）
brew install podman-desktop
podman machine init --now
```

参数说明：
- `--vm-type=vz`：使用 Apple Virtualization.framework，性能更好；
- `--mount-type=virtiofs`：文件共享性能优于默认的 9p；
- `--memory 4 --cpu 4`：可按物理资源调整。

Dev Containers：VS Code + `devcontainer.json` 实现跨平台一致的容器化开发环境。虚拟机：UTM 运行 Linux / Windows 测试环境。

## 常用开发工具清单

以下工具声明在项目 Brewfile 中，CLI 工具与 GUI 应用分别由 `make brew` 和 `make apps` 安装：

- **终端**：iTerm2
- **编辑器**：Visual Studio Code、JetBrains Toolbox
- **AI 编程**：Claude Code（Anthropic CLI 编码助手）、cc-switch-cli（多 AI 代理配置切换）
- **浏览器**：Google Chrome
- **效率工具**：Raycast、Hammerspoon
- **数据库客户端**：TablePlus、Postico、MongoDB Compass
- **网络调试**：Proxyman、Wireshark
- **容器管理**：Podman Desktop
- **虚拟化**：UTM
- **Git GUI**：Fork
- **字体**：JetBrainsMono Nerd Font、MesloLGS NF
- **Mac App Store**：通过 `mas` CLI 管理
```alert
type: info
description: Mac App Store 应用需先执行 `mas signin` 登录。
```

## 自动化部署

以上所有步骤均可通过 [bitnpc/mac-dev-setup](https://github.com/bitnpc/mac-dev-setup) 一键完成，支持三种部署方式：

### Makefile（推荐）

```
make all              # 全自动：bootstrap → brew → shell → languages → git → containers → apps → validate
make bootstrap        # Xcode CLT + Homebrew
make brew             # Brewfile 安装（CLI 工具）
make shell            # Oh My Zsh + 插件 + Starship
make languages        # Python/Ruby/Node/Go/Rust 运行时
make git              # Git 双重身份 + SSH
make containers       # Colima + Podman
make apps             # GUI 应用 + 字体
make validate         # 18 项自检
```

所有脚本（`scripts/*.sh`）均设计为**幂等**（可安全重复执行）。

### chezmoi（dotfiles 管理）
```bash
make chezmoi
```
`chezmoi/` 目录提供完整的 dotfiles 模板（`.zshrc`、`.zprofile`、`.gitconfig`、`.ssh/config` 等），使用 Go 模板语法实现条件渲染与变量注入。部分模板由 setup 脚本自动生成（如语言版本信息、Go PATH 配置）。

### Ansible（多机器编排）
```bash
make ansible
```
`ansible/mac_dev.yml` 以声明式 Ansible playbook 实现上述相同流程，适合在团队多台 Mac 间一致部署。

## 安装结果自检
```bash
# 逐项检查（推荐）
make validate

# 或手动检查
xcode-select --print-path
brew doctor
git --version
python3 --version
node --version
docker info
```

`scripts/validate.sh` 会检查以下 18 项是否就绪：Xcode CLT、Homebrew、Git、Python、pyenv、Ruby、rbenv、Node.js、Volta、Go、Rust（rustc）、Cargo、Docker、Colima、Podman、Starship、chezmoi。

## 常见问题排查
- **命令找不到**：确认 `PATH` 中包含 `/opt/homebrew/bin`、`/opt/homebrew/sbin`，可在 `~/.zprofile` 顶部添加 `eval "$(/opt/homebrew/bin/brew shellenv)"`。
- **Rosetta 支持**：执行 `softwareupdate --install-rosetta` 安装 Rosetta 2，并使用 `arch -x86_64` 运行仅支持 Intel 的旧软件。
- **权限与安全策略**：遇到「无法打开，因为 Apple 无法检查是否包含恶意软件」的提示，可在 Finder 中右键选择「打开」，或 `xattr -d com.apple.quarantine <file>`。
- **网络限制**：准备 VPN / 代理，或为 Homebrew、npm、pip 等设置镜像源，避免安装过程长时间超时。

## 总结
- 先更新系统并安装 Command Line Tools，保证基础工具链一致；
- 通过 Homebrew 管理 CLI / GUI 软件，结合 Brewfile 与 dotfiles 实现可重复部署；
- 使用 iTerm2、Oh My Zsh / Starship 与插件提升终端效率；
- 利用 pyenv、rbenv、volta 等工具管理多语言运行时；
- 建议使用 `init.templateDir` + `post-checkout` hook 方案管理 Git 双重身份，无需手动切换；
- 将全部配置自动化至 `Makefile` 脚本，新机器执行 `make all` 即可快速投入开发。
