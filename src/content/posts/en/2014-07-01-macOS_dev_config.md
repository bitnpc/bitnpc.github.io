---
title: 'macOS Development Environment Setup'
pubDate: 2014-07-01
categories: [Tech, macOS]
tags:
    - Environment Setup
    - macOS
toc: true
description: 'The most common pitfalls when configuring a macOS environment for the first time or after a reinstall revolve around toolchain versions, installation paths, and permission control. This article organizes a general workflow in the order of "System Preparation → Package Management → Terminal & Shell → Language Runtimes → Version Control → Containers & Common Tools" to help you get development work up and running quickly.'
---

## Overview
The most common pitfalls when configuring a macOS environment for the first time or after a reinstall revolve around toolchain versions, installation paths, and permission control. This article organizes a general workflow in the order of "System Preparation → Package Management → Terminal & Shell → Language Runtimes → Version Control → Containers & Common Tools" to help you get development work up and running quickly.

> **One-Click Automation**: The automation script corresponding to this article is available at [bitnpc/mac-dev-setup](https://github.com/bitnpc/mac-dev-setup). Run `make all` to complete the entire configuration. Each section below has a corresponding Makefile target and Shell script, suitable for side-by-side reading.

## Environment Preparation
- **System Update**: It is recommended to upgrade to the latest stable version of macOS (`Settings → General → Software Update`), and apply security updates at the same time.
- **Disk & Permissions**: In `System Settings → Privacy & Security`, grant Full Disk Access to the terminal and development tools to avoid frequent permission prompts during installation.
- **Command Line Tools Check**: Install Command Line Tools via `xcode-select --install`; if already installed, use `xcode-select --print-path` to verify the path points to the expected location.

## Xcode & Command Line Tools
Essential for iOS/macOS App development. The latest version can be downloaded from the [**App Store**](https://apps.apple.com/cn/app/xcode/id497799835?mt=12), and historical versions are available from the [**Developer Center**](https://developer.apple.com/download/applications/).
```alert
type: success
description: Even if you are not developing apps, it is recommended to install Xcode Command Line Tools — they provide clang, git, and other basic tools that many third-party dependencies rely on by default.
```

### Common Commands
```bash
# Current default Xcode path used by the system
xcode-select --print-path

# Switch between multiple versions
sudo xcode-select -switch /Applications/Xcode.app/Contents/Developer

# Install Command Line Tools only
xcode-select --install
```

Automation equivalent: `make bootstrap` → `scripts/bootstrap.sh`

## Homebrew
[**Homebrew**](https://brew.sh/) is the de facto standard package manager on macOS, responsible for installing, upgrading, and uninstalling CLI tools and GUI applications. It is the core of automated environment maintenance.

### Installation & Uninstallation
```bash
# Install (works for both Intel and Apple Silicon)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Uninstall
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
```

After installation, follow the script prompts to inject `brew shellenv` into your current Shell, for example:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Brewfile & Automation
It is recommended to use a Brewfile to manage all dependencies centrally. The `Brewfile` serves as the **single package manifest** for the entire environment — CLI tools, GUI applications, and fonts are all declared within it.

```bash
# Export current dependencies as a Brewfile
brew bundle dump --describe

# Install dependencies from Brewfile
brew bundle install
```

Automation equivalent: `make brew` → `scripts/install_brew_bundle.sh`

### Common Issues
- **Mirror Switching**: For users in China, Tsinghua / USTC mirrors are recommended. Set `HOMEBREW_BREW_GIT_REMOTE` and `HOMEBREW_CORE_GIT_REMOTE` before installation, or use community scripts for batch replacement.
- **Permission Issues**: Apple Silicon installs Homebrew to `/opt/homebrew` by default; on Intel machines, use `sudo chown -R $(whoami) /usr/local/*` to fix legacy permission issues.
- **Environment Variable Residue**: After reinstalling or migrating, clean up old `brew shellenv` entries in `~/.bash_profile` and `~/.zprofile` to prevent pointing to invalid paths.

Reference links:
- [Homebrew Homepage](https://brew.sh/)
- [USTC Homebrew Mirror Guide](https://mirrors.ustc.edu.cn/help/homebrew.git.html)
- [Tsinghua Homebrew Mirror Guide](https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/)

## Terminal & Shell
macOS's built-in Terminal has limited functionality. It is recommended to pair iTerm2, Oh My Zsh, Starship, and useful plugins to create an efficient terminal environment.

Automation equivalent: `make shell` → `scripts/setup_shell.sh`

### iTerm2
```bash
brew install --cask iterm2
```

### Shell Configuration
```bash
# Install Oh My Zsh (skip if already installed)
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Set zsh as the default Shell
chsh -s /bin/zsh

# Install common plugins (autocomplete / syntax highlighting)
brew install zsh-autosuggestions zsh-syntax-highlighting

# Install Starship cross-shell prompt
brew install starship

# Append to ~/.zshrc
cat <<'EOF' >> ~/.zshrc
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
eval "$(starship init zsh)"
EOF
```
```alert
type: info
description: You can use chezmoi to manage dotfiles (`make chezmoi`). The `chezmoi/` directory provides complete `~/.zshrc` and `~/.zprofile` templates with support for conditional rendering and variable injection.
```

## Python Environment
The system Python that ships with macOS is relatively old. It is recommended to use `pyenv` to manage multiple versions.

Automation equivalent: `setup_languages.sh` (as part of `make languages`)

```bash
# Install pyenv and virtual environment plugin
brew install pyenv pyenv-virtualenv pipx

# Initialize (note that pyenv requires hooks in both .zprofile and .zshrc)
echo 'eval "$(pyenv init --path)"' >> ~/.zprofile
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zprofile

# Install a specific version (default 3.11.6)
pyenv install 3.11.6
pyenv global 3.11.6

# (Optional) Create a virtual environment
pyenv virtualenv 3.11.6 project-env
pyenv activate project-env
```

Common helper tools:
- `pipx`: Install CLI tools in isolation (example: `pipx install httpie`);
- `poetry` / `pipenv`: Manage project dependencies and virtual environments;
- `uv`: Quickly create virtual environments and install dependencies, a newer alternative compatible with pip/virtualenv;
- Set `export PIP_REQUIRE_VIRTUALENV=true` in `~/.zshrc` to avoid accidentally installing packages to the global environment.

## Ruby Environment
It is recommended to use the lightweight version manager [**rbenv**](https://github.com/rbenv/rbenv) to avoid injecting too many Shell hooks. If you prefer a unified manager across multiple languages, consider [`asdf`](https://asdf-vm.com/) with a `.tool-versions` file.

Automation equivalent: `setup_languages.sh` (as part of `make languages`)

```bash
# Install rbenv and ruby-build (ruby-build provides the install subcommand)
brew install rbenv ruby-build

# Initialize
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc

# Install a specific version (default 3.2.2, note that OpenSSL path must be specified for Apple Silicon)
RUBY_VERSION=3.2.2
rbenv install $RUBY_VERSION --with-openssl-dir=$(brew --prefix openssl@3)
rbenv global $RUBY_VERSION

# Install common gems
gem install bundler cocoapods
```

## Node.js Environment
It is recommended to use [**Volta**](https://volta.sh/), which provides a great experience on Apple Silicon and can automatically pin versions in a project's `package.json`.

Automation equivalent: `setup_languages.sh` (as part of `make languages`)

```bash
# Install Volta
brew install volta

# Volta automatically registers itself in PATH (needs initialization in ~/.zshrc or ~/.zprofile)
# After reloading the shell, install node/npm
volta install node@20
volta install pnpm
```

Volta pins the selected version globally, while also allowing per-project version overrides declared via the `volta` field in `package.json`. It automatically switches runtime versions when you change project directories, with no need for manual `nvm use`.

Common toolchain:
- Package managers: `npm`, `yarn`, `pnpm`, with `corepack enable` for unified management;
- Formatting & Linting: Add `eslint`, `prettier`, `typescript` to project `devDependencies` and invoke via `npx`;
- Monorepo: Optionally use `turbo`, `nx`, or `lage`, pinning versions first with `volta pin`.

## Other Language Runtimes
Automation equivalent: `setup_languages.sh` (as part of `make languages`)

```bash
# Go
brew install go
mkdir -p $HOME/go/bin
# Add to ~/.zshrc:
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
description: **Version Overrides**: The default versions for the language runtimes above are defined at the top of `scripts/setup_languages.sh` (e.g., `PYTHON_VERSION=3.11.6`, `RUBY_VERSION=3.2.2`, `NODE_VERSION=20`). They can be temporarily modified via environment variables before running: `NODE_VERSION=22 make languages`.
```

## Git & SSH Dual Identity Configuration
Enterprise development typically requires maintaining both a **corporate identity** (GitLab / self-hosted Git services) and a **personal identity** (GitHub), each with different usernames, emails, and SSH keys. This section provides an automatable **dual identity solution** that leverages Git's `init.templateDir` mechanism to automatically switch identities on a per-repository basis.

Automation equivalent: `make git` → `scripts/setup_git.sh`

### Basic Configuration
```bash
brew install git gh glab

# Global default identity — corporate identity
git config --global user.name "Your Name"
git config --global user.email "your@company.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input
git config --global pull.rebase false
```

### Automatic GitHub Identity Switching

Core concept: Use Git's `init.templateDir` to inject a `post-checkout` hook on every `git clone`. After the first checkout, the hook automatically detects whether the remote repository is `github.com` and, if so, adds the GitHub identity as a local configuration.

```bash
# 1. Create a separate GitHub identity config
cat > ~/.gitconfig-github <<EOF
[user]
  name = your-github-username
  email = your-github@email.com
EOF

# 2. Set init.templateDir
git config --global init.templateDir ~/.git-template/hooks/

# 3. Create the post-checkout hook
mkdir -p ~/.git-template/hooks
cat > ~/.git-template/hooks/post-checkout <<'HOOK'
#!/bin/zsh
# Only execute on the initial clone checkout (SHA1 is all zeros)
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

After this, all repositories cloned via `git clone` require no additional steps — GitHub repositories automatically use the separate identity, while corporate repositories use the global default identity.
```alert
type: success
description: For existing local repositories, manually append with `git config include.path ~/.gitconfig-github`.
```

### SSH Keys
```bash
# Generate default key
ssh-keygen -t ed25519 -C "your@company.com"

# Generate GitHub-specific key (does not overwrite the default key)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "your-github@email.com"

# Add to ssh-agent (Apple Silicon supports --apple-use-keychain)
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
ssh-add --apple-use-keychain ~/.ssh/id_ed25519_github
```

### SSH Configuration
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

Recommended companion configuration:
- Log in to GitHub CLI with `gh auth login`;
- Enable `AddKeysToAgent yes` combined with `ssh-add --apple-use-keychain` to avoid repeatedly entering passwords.

## Containers & Virtualization
Automation equivalent: `make containers` → `scripts/setup_containers.sh`

```bash
# Colima (lightweight Docker runtime, recommended for Apple Silicon)
brew install docker
colima start --arch aarch64 --runtime docker --vm-type=vz --mount-type=virtiofs --memory 4 --cpu 4

# Podman Desktop (includes CLI, no Docker Desktop dependency)
brew install podman-desktop
podman machine init --now
```

Parameter explanation:
- `--vm-type=vz`: Uses Apple Virtualization.framework for better performance;
- `--mount-type=virtiofs`: File sharing performance is superior to the default 9p;
- `--memory 4 --cpu 4`: Adjust according to physical resources.

Dev Containers: VS Code + `devcontainer.json` for cross-platform consistent containerized development environments. Virtual Machines: UTM for running Linux / Windows test environments.

## Common Development Tools

The following tools are declared in the project's Brewfile, with CLI tools and GUI applications installed by `make brew` and `make apps` respectively:

- **Terminal**: iTerm2
- **Editor**: Visual Studio Code, JetBrains Toolbox
- **AI Coding**: Claude Code (Anthropic CLI coding assistant), cc-switch-cli (multi-AI agent configuration switching)
- **Browser**: Google Chrome
- **Productivity**: Raycast, Hammerspoon
- **Database Clients**: TablePlus, Postico, MongoDB Compass
- **Network Debugging**: Proxyman, Wireshark
- **Container Management**: Podman Desktop
- **Virtualization**: UTM
- **Git GUI**: Fork
- **Fonts**: JetBrainsMono Nerd Font, MesloLGS NF
- **Mac App Store**: Managed via `mas` CLI
```alert
type: info
description: Mac App Store applications require running `mas signin` first to log in.
```

## Automated Deployment

All of the above steps can be completed with a single command using [bitnpc/mac-dev-setup](https://github.com/bitnpc/mac-dev-setup), which supports three deployment methods:

### Makefile (Recommended)

```
make all              # Fully automatic: bootstrap → brew → shell → languages → git → containers → apps → validate
make bootstrap        # Xcode CLT + Homebrew
make brew             # Brewfile installation (CLI tools)
make shell            # Oh My Zsh + plugins + Starship
make languages        # Python/Ruby/Node/Go/Rust runtimes
make git              # Git dual identity + SSH
make containers       # Colima + Podman
make apps             # GUI applications + fonts
make validate         # 18-item self-check
```

All scripts (`scripts/*.sh`) are designed to be **idempotent** (safe to re-run).

### chezmoi (Dotfiles Management)
```bash
make chezmoi
```
The `chezmoi/` directory provides complete dotfile templates (`.zshrc`, `.zprofile`, `.gitconfig`, `.ssh/config`, etc.), using Go template syntax for conditional rendering and variable injection. Some templates are auto-generated by setup scripts (such as language version information, Go PATH configuration).

### Ansible (Multi-Machine Orchestration)
```bash
make ansible
```
`ansible/mac_dev.yml` implements the same workflow as a declarative Ansible playbook, suitable for consistent deployment across multiple Macs on a team.

## Installation Validation
```bash
# Check item by item (recommended)
make validate

# Or check manually
xcode-select --print-path
brew doctor
git --version
python3 --version
node --version
docker info
```

`scripts/validate.sh` checks whether the following 18 items are ready: Xcode CLT, Homebrew, Git, Python, pyenv, Ruby, rbenv, Node.js, Volta, Go, Rust (rustc), Cargo, Docker, Colima, Podman, Starship, chezmoi.

## Common Troubleshooting
- **Command not found**: Ensure `PATH` includes `/opt/homebrew/bin` and `/opt/homebrew/sbin`. Add `eval "$(/opt/homebrew/bin/brew shellenv)"` at the top of `~/.zprofile`.
- **Rosetta Support**: Run `softwareupdate --install-rosetta` to install Rosetta 2, and use `arch -x86_64` to run legacy Intel-only software.
- **Permissions & Security Policies**: If you encounter "cannot be opened because the developer cannot be verified", right-click and select "Open" in Finder, or run `xattr -d com.apple.quarantine <file>`.
- **Network Restrictions**: Prepare a VPN / proxy, or configure mirrors for Homebrew, npm, pip, etc., to avoid long timeouts during installation.

## Summary
- Update the system and install Command Line Tools first to ensure a consistent base toolchain;
- Use Homebrew to manage CLI / GUI software, combined with Brewfile and dotfiles for reproducible deployment;
- Use iTerm2, Oh My Zsh / Starship, and plugins to boost terminal efficiency;
- Manage multi-language runtimes with pyenv, rbenv, volta, and similar tools;
- Use the `init.templateDir` + `post-checkout` hook approach to manage Git dual identities without manual switching;
- Automate the entire configuration into `Makefile` scripts — run `make all` on a new machine to get started quickly.
