---
title: 'macOS 開発環境のセットアップ'
pubDate: 2014-07-01
categories: [macOS]
tags:
    - Homebrew
    - Shell
    - Git
toc: true
description: 'macOS 開発環境のセットアップ手順を体系的に解説。システム準備、パッケージ管理、シェル設定、言語ランタイム、Git、コンテナまで網羅し、make all で自動再現可能。'
---

## 概要
macOS 環境を初めてセットアップする、あるいは再インストール後に構成する際、ツールチェインのバージョン、インストールパス、権限制御のあたりでつまずきやすいものです。本記事では「システム準備 → パッケージ管理 → ターミナルとシェル → 言語ランタイム → バージョン管理 → コンテナと一般ツール」の順に汎用的なフローを整理し、以降の開発作業を迅速に開始できるようにします。

> **ワンクリック自動化**：本記事に対応する自動化スクリプトは [bitnpc/mac-dev-setup](https://github.com/bitnpc/mac-dev-setup) にまとめてあります。`make all` を実行するだけで全ての設定が完了します。以下の各セクションには対応する Makefile ターゲットとシェルスクリプトが用意されており、対照しながら読むのに適しています。
>

## 環境準備
- **システムアップデート**：まず最新安定版の macOS にアップグレードし（`設定 → 一般 → ソフトウェア・アップデート`）、セキュリティパッチもあわせて適用することを推奨します。
- **ディスクと権限**：「システム設定 → プライバシーとセキュリティ」でターミナルや開発ツールに対してフルディスクアクセスを有効にし、インストール時の頻繁なポップアップを防ぎます。
- **コマンドラインツールの確認**：`xcode-select --install` で Command Line Tools をインストールします。既にインストール済みの場合は `xcode-select --print-path` でパスが想定通りの場所を指しているか確認します。

## Xcode と Command Line Tools
iOS/macOS アプリ開発に必須です。最新バージョンは [**App Store**](https://apps.apple.com/cn/app/xcode/id497799835?mt=12) から、過去のバージョンは [**デベロッパセンター**](https://developer.apple.com/download/applications/) から入手できます。
```alert
type: success
description: アプリ開発をしない場合でも、Xcode Command Line Tools のインストールを推奨します。clang、git などの基本ツールが提供され、多くのサードパーティ依存関係がデフォルトでこれらに依存しています。
```

### よく使うコマンド
```bash
# 現在のシステムで使用されているデフォルトの Xcode パス
xcode-select --print-path

# 複数バージョンの切り替え
sudo xcode-select -switch /Applications/Xcode.app/Contents/Developer

# Command Line Tools のみインストール
xcode-select --install
```

自動化対応：`make bootstrap` → `scripts/bootstrap.sh`

## Homebrew
[**Homebrew**](https://brew.sh/) は macOS における事実上の標準パッケージマネージャーであり、CLI ツールや GUI アプリケーションのインストール、アップグレード、アンインストールを担当し、環境の自動化メンテナンスの中核を担います。

### インストールとアンインストール
```bash
# インストール（Intel と Apple Silicon で共通）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# アンインストール
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
```

インストール完了後、スクリプトの指示に従って `brew shellenv` を現在のシェルに注入します。例：
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Brewfile と自動化
Brewfile を使って全ての依存関係を一元管理することを推奨します。`Brewfile` は環境全体の**唯一のパッケージリスト**であり、CLI ツール、GUI アプリケーション、フォントも全てここに宣言します。

```bash
# 現在の依存関係を Brewfile にエクスポート
brew bundle dump --describe

# Brewfile に従って依存関係をインストール
brew bundle install
```

自動化対応：`make brew` → `scripts/install_brew_bundle.sh`

### よくある問題
- **ミラーソースの切り替え**：国内では清华大学 / 中国科学技術大学のミラーが推奨されます。インストール前に `HOMEBREW_BREW_GIT_REMOTE` と `HOMEBREW_CORE_GIT_REMOTE` を設定するか、コミュニティスクリプトを使って一括置換します。
- **権限不足**：Apple Silicon ではデフォルトで `/opt/homebrew` にインストールされます。Intel マシンでは `sudo chown -R $(whoami) /usr/local/*` で過去に残った権限問題を修正できます。
- **環境変数の残留**：再インストールや移行後は、`~/.bash_profile` と `~/.zprofile` 内の古い `brew shellenv` をクリーンアップし、無効なパスを指さないようにします。

参考リンク：
- [Homebrew 日本語サイト](https://brew.sh/index_ja.html)
- [USTC Homebrew ミラー説明](https://mirrors.ustc.edu.cn/help/homebrew.git.html)
- [清华 Homebrew ミラー説明](https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/)

## ターミナルとシェル
macOS 標準のターミナルは機能が限られているため、iTerm2、Oh My Zsh、Starship、および便利なプラグインを組み合わせて効率的なターミナル環境を構築することをお勧めします。

自動化対応：`make shell` → `scripts/setup_shell.sh`

### iTerm2
```bash
brew install --cask iterm2
```

### シェル設定
```bash
# Oh My Zsh のインストール（既存の場合はスキップ）
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# zsh をデフォルトシェルに設定
chsh -s /bin/zsh

# よく使うプラグインのインストール（自動補完 / シンタックスハイライト）
brew install zsh-autosuggestions zsh-syntax-highlighting

# Starship クロスシェルプロンプトのインストール
brew install starship

# ~/.zshrc に追記
cat <<'EOF' >> ~/.zshrc
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
eval "$(starship init zsh)"
EOF
```
```alert
type: info
description: chezmoi を使って dotfiles を管理することもできます（`make chezmoi`）。`chezmoi/` ディレクトリには完全な `~/.zshrc`、`~/.zprofile` のテンプレートが用意されており、条件付きレンダリングと変数注入に対応しています。
```

## Python 環境
macOS 標準のシステム Python はバージョンが古いため、`pyenv` を使って複数バージョンを管理することを推奨します。

自動化対応：`setup_languages.sh`（`make languages` の一部）

```bash
# pyenv と仮想環境プラグインのインストール
brew install pyenv pyenv-virtualenv pipx

# 初期化（pyenv は .zprofile と .zshrc の両方に hook を設定する必要があることに注意）
echo 'eval "$(pyenv init --path)"' >> ~/.zprofile
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zprofile

# 指定バージョンのインストール（デフォルト 3.11.6）
pyenv install 3.11.6
pyenv global 3.11.6

# （オプション）仮想環境の作成
pyenv virtualenv 3.11.6 project-env
pyenv activate project-env
```

よく使う補助ツール：
- `pipx`：CLI ツールを隔離してインストール（例：`pipx install httpie`）；
- `poetry` / `pipenv`：プロジェクトの依存関係と仮想環境を管理；
- `uv`：仮想環境の高速作成と依存関係のインストールに対応し、pip/virtualenv に代わる新しい選択肢；
- `~/.zshrc` に `export PIP_REQUIRE_VIRTUALENV=true` を設定すると、誤ってグローバル環境にインストールするのを防げます。

## Ruby 環境
軽量なバージョンマネージャー [**rbenv**](https://github.com/rbenv/rbenv) の使用を推奨します。余分なシェル Hook の注入を避けられます。複数言語を統一的に管理したい場合は、[`asdf`](https://asdf-vm.com/) と `.tool-versions` ファイルの組み合わせも検討してください。

自動化対応：`setup_languages.sh`（`make languages` の一部）

```bash
# rbenv と ruby-build のインストール（ruby-build が install サブコマンドを提供）
brew install rbenv ruby-build

# 初期化
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc

# 指定バージョンのインストール（デフォルト 3.2.2、Apple Silicon 対応のため OpenSSL パスの指定が必要）
RUBY_VERSION=3.2.2
rbenv install $RUBY_VERSION --with-openssl-dir=$(brew --prefix openssl@3)
rbenv global $RUBY_VERSION

# よく使う gem のインストール
gem install bundler cocoapods
```

## Node.js 環境
[**Volta**](https://volta.sh/) の使用を推奨します。Apple Silicon 上での動作がスムーズで、プロジェクトの `package.json` にバージョンを自動で固定できます。

自動化対応：`setup_languages.sh`（`make languages` の一部）

```bash
# Volta のインストール
brew install volta

# Volta は自動的に PATH に登録される（~/.zshrc または ~/.zprofile で初期化が必要）
# シェルを再読み込み後、node/npm をインストール
volta install node@20
volta install pnpm
```

Volta は選択したバージョンをグローバルに固定すると同時に、プロジェクトディレクトリの `package.json` で `volta` フィールドを使ってバージョンを上書きすることも可能です。プロジェクトディレクトリを切り替えると自動的にランタイムバージョンが切り替わり、手動で `nvm use` を実行する必要はありません。

よく使うツールチェイン：
- パッケージマネージャー：`npm`、`yarn`、`pnpm`。`corepack enable` を有効にして一元管理；
- フォーマッターと Lint：`eslint`、`prettier`、`typescript` をプロジェクトの `devDependencies` に記述し、`npx` 経由で呼び出し；
- Monorepo：`turbo`、`nx`、`lage` などが選択肢。まず `volta pin` でバージョンを固定。

## その他の言語ランタイム
自動化対応：`setup_languages.sh`（`make languages` の一部）

```bash
# Go
brew install go
mkdir -p $HOME/go/bin
# ~/.zshrc に以下を追加：
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
description: **バージョンの上書き**：上記の言語ランタイムのデフォルトバージョンは `scripts/setup_languages.sh` の先頭で定義されています（例：`PYTHON_VERSION=3.11.6`、`RUBY_VERSION=3.2.2`、`NODE_VERSION=20`）。実行前に環境変数で一時的に変更できます：`NODE_VERSION=22 make languages`。
```

## Git と SSH のデュアルアイデンティティ設定
企業での開発では通常、**社内用の身份**（GitLab / 自社 Git サービス）と**個人用の身份**（GitHub）を同時に管理する必要があり、それぞれでユーザー名、メールアドレス、SSH 鍵が異なります。このセクションでは、Git の `init.templateDir` メカニズムを利用してリポジトリごとに自動切り替えを実現する、自動化可能な**デュアルアイデンティティ方式**を提供します。

自動化対応：`make git` → `scripts/setup_git.sh`

### 基本設定
```bash
brew install git gh glab

# グローバルデフォルト身份 — 会社用身份
git config --global user.name "Your Name"
git config --global user.email "your@company.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input
git config --global pull.rebase false
```

### GitHub 身份の自動切り替え

核心となる考え方：Git の `init.templateDir` を利用して、`git clone` のたびに `post-checkout` hook を注入し、初回 checkout 後にリモートリポジトリが `github.com` かどうかを自動検出し、該当する場合は GitHub 身份をローカル設定として追加します。

```bash
# 1. 独立した GitHub 身份設定ファイルを作成
cat > ~/.gitconfig-github <<EOF
[user]
  name = your-github-username
  email = your-github@email.com
EOF

# 2. init.templateDir を設定
git config --global init.templateDir ~/.git-template/hooks/

# 3. post-checkout hook を作成
mkdir -p ~/.git-template/hooks
cat > ~/.git-template/hooks/post-checkout <<'HOOK'
#!/bin/zsh
# 初回 clone checkout 時のみ実行（SHA1 が全て 0）
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

これ以降、`git clone` したすべてのリポジトリで追加の操作は不要です。GitHub リポジトリは自動的に独立した身份が使われ、社内リポジトリはグローバルデフォルト身份が使われます。
```alert
type: success
description: 既にローカルに存在するリポジトリについては、`git config include.path ~/.gitconfig-github` で手動追加できます。
```

### SSH 鍵
```bash
# デフォルト鍵の生成
ssh-keygen -t ed25519 -C "your@company.com"

# GitHub 専用鍵の生成（デフォルト鍵を上書きしない）
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "your-github@email.com"

# ssh-agent に追加（Apple Silicon では --apple-use-keychain に対応）
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
ssh-add --apple-use-keychain ~/.ssh/id_ed25519_github
```

### SSH 設定
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

あわせて推奨する設定：
- `gh auth login` で GitHub CLI にログイン；
- `AddKeysToAgent yes` と `ssh-add --apple-use-keychain` を組み合わせて、パスワードの再入力を回避。

## コンテナと仮想化
自動化対応：`make containers` → `scripts/setup_containers.sh`

```bash
# Colima（軽量 Docker ランタイム、Apple Silicon 推奨）
brew install docker
colima start --arch aarch64 --runtime docker --vm-type=vz --mount-type=virtiofs --memory 4 --cpu 4

# Podman Desktop（CLI 含む、Docker Desktop に依存しない）
brew install podman-desktop
podman machine init --now
```

パラメータ説明：
- `--vm-type=vz`：Apple Virtualization.framework を使用し、パフォーマンスが向上；
- `--mount-type=virtiofs`：デフォルトの 9p よりファイル共有のパフォーマンスが良好；
- `--memory 4 --cpu 4`：物理リソースに応じて調整可能。

Dev Containers：VS Code + `devcontainer.json` でクロスプラットフォームで一貫したコンテナ化開発環境を実現。仮想マシン：UTM で Linux / Windows テスト環境を実行。

## よく使う開発ツール一覧

以下のツールはプロジェクトの Brewfile に宣言されています。CLI ツールと GUI アプリケーションはそれぞれ `make brew` と `make apps` でインストールします：

- **ターミナル**：iTerm2
- **エディター**：Visual Studio Code、JetBrains Toolbox
- **AI プログラミング**：Claude Code（Anthropic CLI コーディングアシスタント）、cc-switch-cli（複数 AI エージェント設定の切り替え）
- **ブラウザ**：Google Chrome
- **効率化ツール**：Raycast、Hammerspoon
- **データベースクライアント**：TablePlus、Postico、MongoDB Compass
- **ネットワークデバッグ**：Proxyman、Wireshark
- **コンテナ管理**：Podman Desktop
- **仮想化**：UTM
- **Git GUI**：Fork
- **フォント**：JetBrainsMono Nerd Font、MesloLGS NF
- **Mac App Store**：`mas` CLI で管理
```alert
type: info
description: Mac App Store のアプリケーションは、事前に `mas signin` でログインする必要があります。
```

## 自動化デプロイ

上記の全ての手順は [bitnpc/mac-dev-setup](https://github.com/bitnpc/mac-dev-setup) で一括実行でき、3 種類のデプロイ方式に対応しています。

### Makefile（推奨）

```
make all              # フル自動：bootstrap → brew → shell → languages → git → containers → apps → validate
make bootstrap        # Xcode CLT + Homebrew
make brew             # Brewfile インストール（CLI ツール）
make shell            # Oh My Zsh + プラグイン + Starship
make languages        # Python/Ruby/Node/Go/Rust ランタイム
make git              # Git デュアルアイデンティティ + SSH
make containers       # Colima + Podman
make apps             # GUI アプリケーション + フォント
make validate         # 18 項目のセルフチェック
```

全てのスクリプト（`scripts/*.sh`）は**冪等**になるよう設計されており、安全に繰り返し実行できます。

### chezmoi（dotfiles 管理）
```bash
make chezmoi
```
`chezmoi/` ディレクトリには完全な dotfiles テンプレート（`.zshrc`、`.zprofile`、`.gitconfig`、`.ssh/config` など）が用意されており、Go テンプレート構文を使って条件付きレンダリングと変数注入を実現しています。一部のテンプレートはセットアップスクリプトによって自動生成されます（言語バージョン情報、Go PATH 設定など）。

### Ansible（複数マシンオーケストレーション）
```bash
make ansible
```
`ansible/mac_dev.yml` は宣言的な Ansible playbook として上記と同じフローを実装しており、チーム内の複数 Mac への統一的なデプロイに適しています。

## インストール結果のセルフチェック
```bash
# 項目ごとの確認（推奨）
make validate

# または手動で確認
xcode-select --print-path
brew doctor
git --version
python3 --version
node --version
docker info
```

`scripts/validate.sh` は以下の 18 項目が準備できているかチェックします：Xcode CLT、Homebrew、Git、Python、pyenv、Ruby、rbenv、Node.js、Volta、Go、Rust（rustc）、Cargo、Docker、Colima、Podman、Starship、chezmoi。

## よくある問題のトラブルシューティング
- **コマンドが見つからない**：`PATH` に `/opt/homebrew/bin`、`/opt/homebrew/sbin` が含まれているか確認します。`~/.zprofile` の先頭に `eval "$(/opt/homebrew/bin/brew shellenv)"` を追加してください。
- **Rosetta サポート**：`softwareupdate --install-rosetta` で Rosetta 2 をインストールし、`arch -x86_64` を使って Intel 専用の旧ソフトウェアを実行します。
- **権限とセキュリティポリシー**：「開けません。Apple がマルウェアがないか確認できないため」というメッセージが表示された場合は、Finder で右クリックして「開く」を選択するか、`xattr -d com.apple.quarantine <file>` を実行します。
- **ネットワーク制限**：VPN / プロキシを準備するか、Homebrew、npm、pip などのミラーソースを設定して、インストール中の長時間のタイムアウトを回避します。

## まとめ
- 先にシステムをアップデートし、Command Line Tools をインストールして、基本的なツールチェインを統一する；
- Homebrew で CLI / GUI ソフトウェアを管理し、Brewfile と dotfiles を組み合わせて再現可能なデプロイを実現する；
- iTerm2、Oh My Zsh / Starship とプラグインを使ってターミナルの効率を向上させる；
- pyenv、rbenv、volta などのツールで多言語ランタイムを管理する；
- `init.templateDir` + `post-checkout` hook 方式で Git のデュアルアイデンティティを管理し、手動切り替えを不要にする；
- 全ての設定を `Makefile` スクリプトに自動化し、新しいマシンで `make all` を実行するだけで素早く開発を開始できるようにする。
