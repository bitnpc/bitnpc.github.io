---
layout: post
title: "macOS 开发环境配置"
date: 2014-07-01
categories: [技术, macOS]
tags:
    - 环境配置
    - macOS
---

## Xcode
iOS/macOS App 开发必备，最新版本可从 [**App Store**](https://apps.apple.com/cn/app/xcode/id497799835?mt=12) 下载，历史版本在 [**开发者中心**](https://developer.apple.com/download/applications/) 下载
> 如果不是开发 iOS/macOS App 就没有必要安装 Xcode，但需要安装 Xcode 命令行工具，因为很多环境和软件都会使用到和依赖它
{: .prompt-tip }
### 使用
```bash
// 打出当前系统使用的默认 Xcode
xcode-select --print-path
// Xcode 多版本切换
sudo xcode-select -switch /Applications/Xcode8.3/Xcode.app/Contents/Developer
// 仅安装 Xcode 命令行工具
xcode-select --install
```

## Homebrew
[**Homebrew**](https://brew.sh/) 是一款 macOS 平台下的软件包管理工具，拥有安装、卸载、更新、查看、搜索等很多实用的功能。简单的一条指令，就可以实现包管理，而不用你关心各种依赖和文件路径的情况，十分方便快捷。  

### 安装与卸载
```bash
// 安装
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
// 卸载
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
```
- `/bin/bash`: 使用 bash 环境运行
- `curl -fsSL`: 使用 curl 命令下载

### 基本使用
```bash
brew install <packageName>      #安装任意包
brew uninstall <packageName>    #卸载任意包
brew list                       #查看已安装包列表
brew update                     #更新homebrew
brew upgrade <packageName>      #更新指定包
brew upgrade                    #更新所有包
```

#### 系统权限问题
在 Mac OS X 10.11 系统之后，`/usr/local/`{: .filepath } 等系统目录下的文件读写是需要系统 `root` 权限的，以往的 Homebrew 安装如果没有指定安装路径，会默认安装在这些需要系统 `root` 用户读写权限的目录下，导致有些指令需要添加 `sudo` 前缀来执行，比如升级 Homebrew 需要：
```bash
sudo brew update
```

如果你不想每次都使用 `sudo` 指令，你有两种方法可以选择:
* 对 `/usr/local`{: .filepath } 目录下的文件读写进行 `root` 用户授权
```bash
sudo chown -R $USER /usr/local
```

* （推荐）安装 Homebrew 时对安装路径进行指定，直接安装在不需要系统 `root` 用户授权就可以自由读写的目录下

```bash
<install path> -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```
如果遇到无法安装的问题，可以考虑替换仓库源。

参考：
- [Homebrew 中文主页](https://brew.sh/index_zh-cn.html)
- [Homebrew Bottles 源使用帮助](http://mirrors.ustc.edu.cn/help/homebrew-bottles.html)
- [Homebrew Cask 源使用帮助](http://mirrors.ustc.edu.cn/help/homebrew-cask.git.html)
- [Homebrew Core 源使用帮助](http://mirrors.ustc.edu.cn/help/homebrew-core.git.html)

## 终端工具
macOS 自带的终端，用起来虽然有些不太方便，界面也不够友好。iTerm2 是一款相对比较好用的终端工具。
iTerm2 常用操作包括主题选择、声明高亮、自动填充建议、隐藏用户名和主机名、分屏效果等.
```bash
brew cask install iterm2
```
### 配置 Oh My Zsh
Oh My Zsh 是对主题的进一步扩展
```bash
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```
设置 zsh 为当前用户的默认 shell
```bash
chsh -s /bin/zsh
```
修改中意的主题，将主题修改为ZSH_THEME="ys"
```bash
vim ~/.zshrc
```


## RVM
[**RVM**](https://rvm.io/) 是一个便捷的多版本 ruby 环境的管理和切换工具。
### 安装
安装目录位于 `~/.rvm`{: .filepath }
```bash
curl -sSL https://get.rvm.io | bash -s stable
source ~/.bashrc
source ~/.bash_profile
```

修改RVM源
为了提高安装速度，修改 RVM，改用 ruby-china 镜像源。
```bash
echo "ruby_url=https://cache.ruby-china.org/pub/ruby" > ~/.rvm/user/db
```

### 使用
查看版本
```bash
rvm list known              #查看可安装的版本
rvm install ruby-2.7.2      #安装ruby 2.7.2版本
rvm list                    #查询已经安装的ruby版本
```

创建 `gemset`，当前使用的 gems 环境可以在 `~/.rvm/gems`{: .filepath } 路径中查看
```bash
rvm gemset create tony
rvm use 2.7.0@tony --default
```
安装 gems，如 bundler, cocoapods
```bash
gem install cocoapods -v 1.8.1
pod --version
```

切换版本
```bash
rvm use 3.0.0               #使用3.0.0版本
rvm use 3.0.0 --default     #使用3.0.0版本，并设置该版本为默认版本
```

卸载版本
```bash
rvm remove 3.0.0            #卸载一个已安装版本
```

### 更新RVM
```bash
rvm get stable
```

## Git
### 安装
macOS 自带 Git，其版本取决于 macOS 版本

### 配置
配置全局用户名和邮件，也可切换到指定目录后配置
```bash
// 全局配置
git config --global user.name "Your Name Here"
git config --global user.email "your_email@youremail.com"
// 按 git 仓库配置，配置后，可在 .git 目录下的 config 文件查看
git config user.name "Your Name Here"
git config user.email "your_email@youremail.com"
```

配置 SSH key
```bash
cd ~/.ssh
ls -al

ssh-keygen -t rsa -C "your_email@example.com"
```

注：如有配置多个 ssh-key 的需求，需要在 `~/.ssh`{: .filepath } 添加 config 文件。如下图所示，GitHub 和 内网 Gitlab 使用了不同的 ssh-key。
config 文件的格式如下
```bash
Host github.com
HostName github.com
IdentityFile ~/.ssh/github
PreferredAuthentications publickey
User tony

Host gitlab.com
HostName gitlab.com
IdentityFile ~/.ssh/gitlab
PreferredAuthentications publickey
User tony
```
{: file="~/.ssh/config" }
