---
layout: post
title: "macOS 开发环境配置"
date: 2014-07-01
categories: [技术, macOS]
tags:
    - 环境配置
    - macOS
---

## 概述
第一次配置或重装后的 macOS 环境时，最容易踩坑的地方集中在工具链版本、安装路径与权限控制。本文按「系统准备 → 包管理 → 终端与 Shell → 语言运行时 → 版本控制 → 容器与常用工具」的顺序整理一套通用流程，确保后续开发工作可快速投入。

## 环境准备
- **系统更新**：建议先升级至最新稳定版 macOS（`设置 → 通用 → 软件更新`），同步更新安全补丁。
- **磁盘与权限**：在「系统设置 → 隐私与安全性」中为终端、开发工具开启完全磁盘访问，以避免安装时频繁弹窗。
- **命令行工具检查**：通过 `xcode-select --install` 安装 Command Line Tools；若已安装，可使用 `xcode-select --print-path` 检查路径是否指向预期位置。

## Xcode 与 Command Line Tools
iOS/macOS App 开发必备，最新版本可从 [**App Store**](https://apps.apple.com/cn/app/xcode/id497799835?mt=12) 下载，历史版本在 [**开发者中心**](https://developer.apple.com/download/applications/) 获取。
> 即便不开发 App，也推荐安装 Xcode Command Line Tools，它提供 clang、git 等基础工具，许多第三方依赖都默认依赖于此。
{: .prompt-tip }

### 常用命令
```bash
# 当前系统使用的默认 Xcode 路径
xcode-select --print-path

# 多版本切换
sudo xcode-select -switch /Applications/Xcode.app/Contents/Developer

# 仅安装 Command Line Tools
xcode-select --install
```

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

### 基本用法
```bash
brew update                     # 更新 Homebrew 自身
brew upgrade                    # 更新所有已安装的包
brew install <pkg>              # 安装指定包
brew uninstall <pkg>            # 卸载指定包
brew list                       # 查看已安装包列表
```

### Brewfile 与自动化
```bash
brew bundle dump --describe     # 导出当前依赖为 Brewfile
brew bundle install             # 按 Brewfile 安装依赖
```
配合 dotfiles 仓库或 CI，可让团队在新机器上一键复现相同依赖集。

### 常见问题
- **镜像源切换**：国内推荐使用清华 / 中科大镜像，安装前设置 `HOMEBREW_BREW_GIT_REMOTE` 与 `HOMEBREW_CORE_GIT_REMOTE`，或使用社区脚本批量替换。
- **权限不足**：Apple Silicon 默认安装在 `/opt/homebrew`；Intel 机器可使用 `sudo chown -R $(whoami) /usr/local/*` 修复早年遗留权限。
- **环境变量残留**：重装或迁移后，清理 `~/.bash_profile` 与 `~/.zprofile` 中旧的 `brew shellenv`，防止指向失效路径。

参考链接：
- [Homebrew 中文主页](https://brew.sh/index_zh-cn.html)
- [USTC Homebrew 镜像说明](https://mirrors.ustc.edu.cn/help/homebrew.git.html)
- [清华 Homebrew 镜像说明](https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/)

## 终端与 Shell
macOS 自带 Terminal 功能有限，推荐搭配 iTerm2、Oh My Zsh（或 Starship）与常用插件打造高效终端环境。

### iTerm2
```bash
brew install --cask iterm2
```

### Shell 配置
```bash
# 安装 Oh My Zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# 将 zsh 设为默认 Shell
chsh -s /bin/zsh

# 安装常用插件（自动补全 / 高亮）
brew install zsh-autosuggestions zsh-syntax-highlighting
cat <<'EOF' >> ~/.zshrc
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
EOF

# Starship 通用提示符（跨 Shell）
brew install starship
echo 'eval "$(starship init zsh)"' >> ~/.zshrc
```

## Ruby 环境
Ruby 生态常用的版本管理器包括 [**RVM**](https://rvm.io/)、[`rbenv`](https://github.com/rbenv/rbenv) 与 [`asdf`](https://asdf-vm.com/)。RVM 功能最丰富但会注入大量 Shell Hook，若强调轻量、兼容性，可优先考虑 `rbenv` 或跨语言统一方案 `asdf`。

```bash
# RVM 安装（目录默认位于 ~/.rvm）
curl -sSL https://get.rvm.io | bash -s stable --ruby
source ~/.rvm/scripts/rvm

# 国内镜像加速
echo "ruby_url=https://cache.ruby-china.org/pub/ruby" > ~/.rvm/user/db

# 常用命令
rvm list known
rvm install 3.2.2
rvm use 3.2.2 --default
rvm gemset create blog
rvm use 3.2.2@blog --default
```

```bash
# rbenv 安装与初始化
brew install rbenv ruby-build
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc
rbenv install 3.2.2
rbenv global 3.2.2
gem install bundler cocoapods
```

如需在多语言间统一管理，可使用 `asdf plugin add ruby` 搭配 `.tool-versions` 文件，便于团队共享版本。

## Git
macOS 自带 Git，版本随系统升级；如需最新特性，可通过 Homebrew 安装 `brew install git`。

### 基本配置
```bash
git config --global user.name "Your Name"
git config --global user.email "your_email@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input
git config --global pull.rebase false
```

### SSH Key
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

如需管理多个仓库，可在 `~/.ssh/config` 中指定不同主机与密钥：
```bash
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github

Host gitlab.internal
  HostName gitlab.internal.company
  User git
  IdentityFile ~/.ssh/id_ed25519_company
```
{: file="~/.ssh/config" }

建议同步配置：
- 使用 `gh auth login` / `glab auth login` 管理 GitHub、GitLab CLI；
- 安装 [Git Credential Manager](https://github.com/git-ecosystem/git-credential-manager) 保存凭证；
- 在 `~/.ssh/config` 中启用 `AddKeysToAgent yes` 结合 `ssh-add --apple-use-keychain`，提升多仓库体验。

## Python 环境
macOS 自带的系统 Python 版本较旧，建议使用 `pyenv` 或官方安装包来管理多版本。

```bash
# 安装 pyenv 及常用插件
brew install pyenv pyenv-virtualenv

# 为 zsh 添加初始化脚本
echo 'eval "$(pyenv init --path)"' >> ~/.zprofile
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zprofile
source ~/.zshrc

# 安装并使用指定版本
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

## Node.js 环境
推荐使用版本管理器，以便在多个项目间快速切换。

### 使用 Volta（Apple Silicon 体验较好）
```bash
curl https://get.volta.sh | bash

# 重新加载 shell 后安装 node/npm
volta install node@20
volta install pnpm
```
Volta 会把选定版本固定在全局，同时允许在项目目录的 `package.json` 中声明覆盖版本。

### 使用 nvm
```bash
brew install nvm
mkdir -p ~/.nvm
cat <<'EOF' >> ~/.zshrc
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
EOF
source ~/.zshrc

nvm install 20
nvm use 20
nvm alias default 20
```

常见工具链：
- 包管理器：`npm`、`yarn`、`pnpm`，开启 `corepack enable` 统一管理；
- 格式化与 Lint：将 `eslint`、`prettier`、`typescript` 写入项目 `devDependencies`，通过 `npx` 调用；
- 包缓存：结合 `pnpm fetch`、`npm cache` 与公司内源，提升安装速度；
- Monorepo：可选 `turbo`、`nx` 或 `lage`，先用 `volta pin` 固定版本。

## 其他语言运行时
- **Go**：`brew install go` 或从 [go.dev](https://go.dev/dl/) 下载官方包，设置 `GOPATH`、`GOBIN`，并在 `~/.zshrc` 中追加 `export GOPATH=$HOME/go`。
- **Rust**：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`，随后执行 `rustup component add rustfmt clippy`。
- **Java / Kotlin**：`brew install temurin` 安装 LTS 版本，或使用 `sdkman` 在多版本之间切换。
- **多语言统一**：`asdf` 通过插件管理 Node、Python、Ruby、Elixir 等，使用 `.tool-versions` 固定团队标准。

## 容器与虚拟化
- Docker Desktop：`brew install --cask docker`，Apple Silicon 可配合 `colima start` 使用轻量虚拟化。
- Podman：`brew install podman podman-desktop`，不依赖额外授权，兼容 OCI 镜像。
- Dev Containers：VS Code + `devcontainer.json`，实现跨平台一致的容器化开发环境。
- 虚拟机：UTM、Parallels 或 VMware Fusion 运行 Linux / Windows 测试环境；必要时开启 `sudo softwareupdate --install-rosetta` 运行 x86_64 镜像。

## 常用开发工具清单
- 编辑器：`Visual Studio Code`、`JetBrains Toolbox`、`Neovim`；
- 数据库与可视化：`TablePlus`、`Postico`、`MongoDB Compass`；
- 网络调试：`Charles`、`Proxyman`、`Wireshark`；
- 自动化与效率：`Raycast`、`Alfred`、`Hammerspoon`；
- 字体与终端美化：`JetBrainsMono Nerd Font`、`MesloLGS NF`。

> 建议将常用安装步骤整理成脚本或 dotfiles 仓库，通过 `Makefile` / `Ansible` / `chezmoi` 自动化执行，缩短新机器上线时间。
{: .prompt-info }

## 常见问题排查
- 命令找不到：确认 `PATH` 中包含 `/opt/homebrew/bin`、`/opt/homebrew/sbin`，可在 `~/.zprofile` 顶部添加 `eval "$(/opt/homebrew/bin/brew shellenv)"`。
- Rosetta 支持：执行 `softwareupdate --install-rosetta` 安装 Rosetta 2，并使用 `arch -x86_64` 运行仅支持 Intel 的旧软件。
- 权限与安全策略：遇到「无法打开，因为 Apple 无法检查是否包含恶意软件」的提示，可在 Finder 中右键选择「打开」，或 `xattr -d com.apple.quarantine <file>`。
- 网络限制：准备 VPN / 代理，或为 Homebrew、npm、pip 等设置镜像源，避免安装过程长时间超时。

## 安装结果自检
```bash
xcode-select --print-path
brew doctor
git --version
python3 --version
node --version
docker info
```

## 总结
- 先更新系统并安装 Command Line Tools，保证基础工具链一致；
- 通过 Homebrew 管理 CLI / GUI 软件，结合镜像与 dotfiles 实现可重复部署；
- 使用 iTerm2、Oh My Zsh / Starship 与插件提升终端效率；
- 利用 pyenv、rbenv、volta、asdf 等工具管理多语言运行时；
- 配置 Git、SSH、容器、常用客户端与自动化脚本，形成自检清单。

按以上步骤配置后，新机器可在半天内完成开发环境搭建，并根据团队需求扩展特定框架、数据库或云端工具。
