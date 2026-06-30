# Tony's Blog

A technical blog about iOS/macOS development, audio/video technology, smart home, and AI — built across three languages: English, Chinese, and Japanese.

> **Site:** [https://bitnpc.github.io](https://bitnpc.github.io)

---

## English

A trilingual (中文 · English · 日本語) technical blog built with [Astro v6](https://astro.build), **Tailwind CSS v4**, **daisyUI v5**, **Pagefind** search, **Giscus** comments, and **KaTeX** math.

### Tech Stack

| Layer               | Choice                                                    |
| ------------------- | --------------------------------------------------------- |
| Framework           | Astro v6                                                  |
| Styling             | Tailwind CSS v4 + daisyUI v5                              |
| Content             | MDX content collections (Zod schema)                      |
| i18n                | Trilingual (zh-CN default, en, ja) via filesystem routing |
| Search              | Pagefind (static full-text search)                        |
| Comments            | Giscus (GitHub Discussions)                               |
| Math                | KaTeX via remark-math + rehype-katex                      |
| Syntax Highlighting | Expressive Code (Shiki)                                   |
| OG Images           | Satori (build-time SVG → PNG)                             |
| Package Manager     | Bun                                                       |
| CI/CD               | GitHub Actions → GitHub Pages                             |

### Commands

| Command             | Action                                                       |
| ------------------- | ------------------------------------------------------------ |
| `bun dev`           | Start dev server at `localhost:4321`                         |
| `bun run build`     | Build production site to `./dist/` (includes Pagefind index) |
| `bun preview`       | Preview production build locally                             |
| `bun run lint`      | Run ESLint (zero warnings)                                   |
| `bun run format`    | Format with Prettier                                         |
| `bun run typecheck` | Type check with `astro check`                                |
| `bun test`          | Run tests                                                    |

### Project Structure

```
src/
├── config.ts              # Site identity, nav, socials, Giscus
├── content.config.ts      # Post/page Zod schemas
├── content/
│   └── posts/{zh,en,ja}/  # Blog posts per locale
│   └── pages/{zh,en,ja}/  # Static pages (about, privacy)
├── pages/
│   └── [...locale]/        # Locale-aware routes
│       ├── index.astro     # Homepage (paginated post listing)
│       ├── posts/[...slug] # Individual post pages
│       ├── archives/       # Timeline archive
│       ├── categories/     # Category listings
│       ├── tags/           # Tag listings
│       ├── search/         # Pagefind search page
│       └── rss.xml.ts     # Per-locale RSS feeds
├── layouts/
│   ├── BaseLayout.astro    # Shell (sidebar, topbar, footer, SEO)
│   ├── PostLayout.astro    # Post/article layout with TOC
│   └── PageLayout.astro    # Minimal page layout
├── components/
│   ├── islands/            # Client-hydrated (ThemeToggle, Search, Giscus, TOC)
│   ├── PostCard.astro      # Homepage listing cards
│   ├── Sidebar.astro       # Left sidebar navigation
│   ├── SEO.astro           # Meta/OG/hreflang tags
│   └── ...                 # Pagination, PostNav, SmartImage, etc.
├── i18n/
│   ├── utils.ts            # withBase, localizedPath, useTranslations, formatDate
│   └── ui.ts               # Translation dictionaries (all UI strings)
├── utils/
│   ├── posts.ts            # Collection query helpers (getPosts, groupBy*, etc.)
│   ├── og-image.ts         # Satori OG image generation
│   └── seo.ts              # SEO meta builder
├── plugins/
│   └── remark-alert.ts     # Custom alert/notification blocks
└── styles/
    └── global.css          # Tailwind entry, daisyUI themes, Chirpy-specific styles
```

### Writing Posts

Create a `.md` or `.mdx` file in `src/content/posts/<locale>/`:

```markdown
---
title: 'My Post Title'
description: 'A short summary (≤280 chars).'
pubDate: 2026-06-29
tags: [tech, tutorial]
categories: [Tech]
toc: true
---

Content here...
```

#### Key frontmatter fields

| Field            | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `tags`           | Array of tags                                               |
| `categories`     | Single category per post                                    |
| `draft`          | Skip in production builds                                   |
| `pinned`         | Pin to top of listings                                      |
| `unlisted`       | Hidden from listings/RSS/sitemap, accessible via direct URL |
| `math`           | Enable KaTeX on this page (loads CSS only when needed)      |
| `translationKey` | Links translations across locales; falls back to file slug  |
| `toc`            | Show table of contents (default: `true`)                    |
| `heroImage`      | Featured image (local import, public path, or remote URL)   |

#### Translations

Posts across locales are linked by `translationKey`. When viewing a post, the language switcher jumps to the corresponding translation. If no translation exists for a locale, it falls back to the default locale.

### Configuration

All site settings are in `src/config.ts`. Environment variables (`.env`) feed into config at build time — any variable prefixed with `PUBLIC_` is available.

Key settings:

- **SITE.title**, **SITE.description**, **SITE.author** — Blog identity
- **SITE.locales** — `['zh', 'en', 'ja']` (zh is default, serves at root)
- **NAV** — Navigation links in sidebar
- **SOCIALS** — Social links built from env vars (empty handles are hidden)
- **GISCUS** — Comment system config (requires env vars to enable)

#### Environment variables

| Variable                | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `SITE_URL`              | Production URL (default: `https://bitnpc.github.io`) |
| `PUBLIC_GITHUB_HANDLE`  | GitHub profile link in sidebar                       |
| `PUBLIC_GISCUS_ENABLED` | Enable comments                                      |
| `PUBLIC_GISCUS_REPO`    | Giscus repo (`owner/repo`)                           |

### Customization

| What                            | Where                                     |
| ------------------------------- | ----------------------------------------- |
| Site title, description, author | `src/config.ts`                           |
| Fonts                           | `astro.config.mjs` (Astro Fonts API)      |
| Theme colors                    | daisyUI tokens in `src/styles/global.css` |
| Avatar                          | `src/assets/images/site/avatar.svg`       |
| Favicon                         | `src/assets/images/site/favicon.svg`      |
| Default OG image                | `src/assets/images/site/og-default.svg`   |

### License

MIT — see [LICENSE](./LICENSE).

---

## 中文

iOS/macOS 开发、音视频技术、智能家居与 AI 相关的技术博客，支持三语言。

> **站点：** [https://bitnpc.github.io](https://bitnpc.github.io)

基于 [Astro v6](https://astro.build) 构建，使用 **Tailwind CSS v4** + **daisyUI v5** 主题系统、**Pagefind** 全站搜索、**Giscus** 评论、**KaTeX** 数学公式。

### 技术栈

| 层       | 选型                                       |
| -------- | ------------------------------------------ |
| 框架     | Astro v6                                   |
| 样式     | Tailwind CSS v4 + daisyUI v5               |
| 内容     | MDX Content Collections（Zod 校验）        |
| 国际化   | 三语言（zh-CN 默认，en，ja），文件系统路由 |
| 搜索     | Pagefind（静态全文搜索）                   |
| 评论     | Giscus（GitHub Discussions）               |
| 数学公式 | KaTeX（remark-math + rehype-katex）        |
| 代码高亮 | Expressive Code（Shiki）                   |
| OG 图片  | Satori（构建时 SVG → PNG）                 |
| 包管理器 | Bun                                        |
| CI/CD    | GitHub Actions → GitHub Pages              |

### 常用命令

| 命令                | 作用                                         |
| ------------------- | -------------------------------------------- |
| `bun dev`           | 启动开发服务器 `localhost:4321`              |
| `bun run build`     | 构建生产版本到 `./dist/`（含 Pagefind 索引） |
| `bun preview`       | 本地预览构建结果                             |
| `bun run lint`      | 运行 ESLint                                  |
| `bun run format`    | 用 Prettier 格式化                           |
| `bun run typecheck` | TypeScript 类型检查                          |

### 项目结构

```
src/
├── config.ts              # 站点标识、导航、社交链接、Giscus
├── content.config.ts      # 文章/页面的 Zod schema
├── content/
│   └── posts/{zh,en,ja}/  # 各语言文章
│   └── pages/{zh,en,ja}/  # 静态页面（关于、隐私）
├── pages/
│   └── [...locale]/        # 多语言路由
├── layouts/                # 页面布局模板
├── components/             # UI 组件
├── i18n/                   # 国际化字典和工具函数
├── utils/                  # 工具函数
├── plugins/                # Remark 插件
└── styles/                 # Tailwind + daisyUI 主题
```

### 写文章

在 `src/content/posts/<locale>/` 下创建 `.md` 或 `.mdx` 文件。

### 配置

所有配置在 `src/config.ts` 中。环境变量（`.env`）在构建时注入。

---

## 日本語

iOS/macOS 開発、音声・動画技術、スマートホーム、AI に関するテクニカルブログです。3言語対応。

> **サイト：** [https://bitnpc.github.io](https://bitnpc.github.io)

[Astro v6](https://astro.build) ベース、**Tailwind CSS v4** + **daisyUI v5** テーマシステム、**Pagefind** 検索、**Giscus** コメント、**KaTeX** 数式を採用。

### 技術スタック

| レイヤー               | 選択                                |
| ---------------------- | ----------------------------------- |
| フレームワーク         | Astro v6                            |
| スタイリング           | Tailwind CSS v4 + daisyUI v5        |
| コンテンツ             | MDX Content Collections（Zod）      |
| i18n                   | 3言語（zh-CN 標準、en、ja）         |
| 検索                   | Pagefind（静的全文検索）            |
| コメント               | Giscus（GitHub Discussions）        |
| 数式                   | KaTeX（remark-math + rehype-katex） |
| コードハイライト       | Expressive Code（Shiki）            |
| OG 画像                | Satori（ビルド時 SVG → PNG）        |
| パッケージマネージャー | Bun                                 |
| CI/CD                  | GitHub Actions → GitHub Pages       |

### コマンド

| コマンド            | 内容                                  |
| ------------------- | ------------------------------------- |
| `bun dev`           | 開発サーバー起動 `localhost:4321`     |
| `bun run build`     | プロダクションビルド（Pagefind 含む） |
| `bun preview`       | ビルド結果をローカルプレビュー        |
| `bun run lint`      | ESLint 実行                           |
| `bun run format`    | Prettier フォーマット                 |
| `bun run typecheck` | 型チェック                            |

### プロジェクト構成

```
src/
├── config.ts              # サイト設定
├── content.config.ts      # 投稿/ページのスキーマ
├── content/
│   └── posts/{zh,en,ja}/  # 言語別の投稿
│   └── pages/{zh,en,ja}/  # 静的ページ（自己紹介、プライバシー）
├── pages/
│   └── [...locale]/        # 多言語ルーティング
├── layouts/                # レイアウトテンプレート
├── components/             # UI コンポーネント
├── i18n/                   # 国際化辞書とユーティリティ
├── utils/                  # ユーティリティ
├── plugins/                # Remark プラグイン
└── styles/                 # Tailwind + daisyUI テーマ
```

### 投稿方法

`src/content/posts/<locale>/` に `.md` または `.mdx` ファイルを作成してください。

### 設定

`src/config.ts` で全設定を管理。環境変数（`.env`）はビルド時に反映されます。
