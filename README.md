# Tony's Blog

A trilingual (中文 · English · 日本語) technical blog built with [Astro v6](https://astro.build), **Tailwind CSS v4**, **daisyUI v5**, **Pagefind** search, **Giscus** comments, and **KaTeX** math.

> **Site:** [https://bitnpc.github.io](https://bitnpc.github.io)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Astro v6 |
| Styling | Tailwind CSS v4 + daisyUI v5 |
| Content | MDX content collections (Zod schema) |
| i18n | Trilingual (zh-CN default, en, ja) via filesystem routing |
| Search | Pagefind (static full-text search) |
| Comments | Giscus (GitHub Discussions) |
| Math | KaTeX via remark-math + rehype-katex |
| Syntax Highlighting | Expressive Code (Shiki) |
| OG Images | Satori (build-time SVG → PNG) |
| Fonts | Lato (headings), Source Sans 3 (body), JetBrains Mono (code) |
| Package Manager | Bun |
| CI/CD | GitHub Actions → GitHub Pages |

## Commands

| Command | Action |
|---------|--------|
| `bun dev` | Start dev server at `localhost:4321` |
| `bun run build` | Build production site to `./dist/` (includes Pagefind index) |
| `bun preview` | Preview production build locally |
| `bun run lint` | Run ESLint (zero warnings) |
| `bun run format` | Format with Prettier |
| `bun run typecheck` | Type check with `astro check` |
| `bun test` | Run tests |

## Project Structure

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

## Writing Posts

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

### Key frontmatter fields

| Field | Description |
|-------|-------------|
| `tags` | Array of tags |
| `categories` | Array of categories (shown as badges) |
| `draft` | Skip in production builds |
| `pinned` | Pin to top of listings |
| `unlisted` | Hidden from listings/RSS/sitemap, accessible via direct URL |
| `math` | Enable KaTeX on this page (loads CSS only when needed) |
| `translationKey` | Links translations across locales; falls back to file slug |
| `toc` | Show table of contents (default: `true`) |
| `heroImage` | Featured image (local import, public path, or remote URL) |

### Translations

Posts across locales are linked by `translationKey`. When viewing a post, the language switcher jumps to the corresponding translation. If no translation exists for a locale, it falls back to the default locale.

## Configuration

All site settings are in `src/config.ts`. Environment variables (`.env`) feed into config at build time — any variable prefixed with `PUBLIC_` is available.

Key settings:
- **SITE.title**, **SITE.description**, **SITE.author** — Blog identity
- **SITE.locales** — `['zh', 'en', 'ja']` (zh is default, serves at root)
- **NAV** — Navigation links in sidebar
- **SOCIALS** — Social links built from env vars (empty handles are hidden)
- **GISCUS** — Comment system config (requires env vars to enable)

### Environment variables

| Variable | Purpose |
|----------|---------|
| `SITE_URL` | Production URL (default: `https://bitnpc.github.io`) |
| `PUBLIC_GITHUB_HANDLE` | GitHub profile link in sidebar |
| `PUBLIC_GISCUS_ENABLED` | Enable comments |
| `PUBLIC_GISCUS_REPO` | Giscus repo (`owner/repo`) |

## Customization

| What | Where |
|------|-------|
| Site title, description, author | `src/config.ts` |
| Fonts | `astro.config.mjs` (Astro Fonts API) |
| Theme colors | daisyUI tokens in `src/styles/global.css` |
| Avatar | `src/assets/images/site/avatar.svg` |
| Favicon | `src/assets/images/site/favicon.svg` |
| Default OG image | `src/assets/images/site/og-default.svg` |

## License

MIT — see [LICENSE](./LICENSE).
