# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

| Command | Action |
|---------|--------|
| `bun dev` | Start dev server at `http://localhost:4321` |
| `bun run build` | Production build to `./dist/` (includes Pagefind index) |
| `bun preview` | Preview production build locally |
| `bun run lint` | ESLint (zero warnings enforced) |
| `bun run lint:fix` | ESLint with auto-fix |
| `bun run format` | Prettier format all sources |
| `bun run format:check` | Prettier check only |
| `bun run typecheck` | `astro check` for type errors |
| `bun test` | Run Bun tests |

## Architecture

This is a **trilingual Astro v6 blog** (zh=default, en, ja) forked from the Chirping Astro theme. It deploys to GitHub Pages via the workflow at `.github/workflows/deploy.yml`.

### Routing: `src/pages/[...locale]/`

All locale-aware routes live under the catch-all `[...locale]` directory. The default locale (zh) serves at the URL root with no prefix; other locales are prefixed (e.g. `/en/posts/...`). Locale is detected from the URL pathname by `detectLocale()` in `src/i18n/utils.ts`. The `404.astro` page and `og/[...slug].png.ts` (OG image generation endpoint) live outside the locale catch-all since they don't need localization.

### Content Collections

Content lives under `src/content/`, organized as:

```
src/content/
  posts/{zh,en,ja}/   → MD/MDX blog posts per locale
  pages/{zh,en,ja}/   → MD/MDX static pages (about, privacy)
```

The collection schemas are defined in `src/content.config.ts` using Astro v6's loader API with Zod. Locale is **inferred from the file path** (`posts/en/foo.md` → locale `en`) but can be overridden via frontmatter `lang:`. Posts across locales are linked via `translationKey` in frontmatter (falls back to slug).

### Config: `src/config.ts`

Single source of truth for site identity (`SITE`), navigation (`NAV`), social links (`SOCIALS`), Giscus (`GISCUS`), and Pagefind (`PAGEFIND`). Environment variables (from `.env` / CI) feed into this file and must be prefixed with `PUBLIC_` to be available at build time. **Never hardcode personal handles or URLs** — they come from env vars.

### i18n: `src/i18n/`

- `ui.ts` — Dictionary maps (`messages`) keyed by locale; all UI strings defined here. TypeScript enforces that every locale has every key.
- `utils.ts` — `withBase()`, `localizedPath()`, `detectLocale()`, `stripLocale()`, `useTranslations()`, `formatDate()`, `alternates()` for hreflang.
- `index.ts` — Re-exports everything.

### Layouts: `src/layouts/`

- `BaseLayout.astro` — Root `<html>` shell with theme script (prevents FOUC), fonts, SEO tags, sidebar, topbar, footer, panel rail.
- `PostLayout.astro` — Single post/page layout with TOC, author box, post nav, Giscus.
- `PageLayout.astro` — Minimal wrapper for standalone pages.

### Components: `src/components/`

- `SEO.astro` — Renders all `<meta>`, `<link rel="alternate">`, OG, robots tags from `SeoMeta`.
- `Sidebar.astro`, `Topbar.astro`, `Footer.astro` — Persistent shell chrome.
- `PostCard.astro`, `PostList.astro`, `PostMeta.astro`, `PostNav.astro` — Post listing/navigation.
- `Pagination.astro` — Page navigation for listing pages.
- `SmartImage.astro` — Handles hero images (Astro `Image` + fallback logic).
- `Callout.astro`, `Panel.astro`, `VideoEmbed.astro`, `MathStyles.astro` — Content components.
- `src/components/islands/` — Hydrated client components (ThemeToggle, LanguageSwitcher, SearchButton, TableOfContents, Giscus, BackToTop).

### Utilities: `src/utils/`

- `posts.ts` — `getPosts()`, `getPostBySlug()`, `getPostsByTag()`, `getPostsByCategory()`, grouping/archiving helpers. All content queries filter drafts in production and sort by pinned + pubDate desc.
- `og-image.ts` — Satori-based OG image generation (build-time SVG → PNG).
- `seo.ts` — `buildSeo()` constructs the `SeoMeta` object from page props.
- `reading-time.ts` — Word-count based reading time.
- `slugify.ts` — URL-safe slug generation.

### Plugins: `src/plugins/`

- `remark-alert.ts` — Converts ```` ```alert ```` fenced blocks to daisyUI alert HTML (info/success/warning/error with optional icons).
- `remark-ashtml.ts` — Allows inline raw HTML through a remark pass-through.

### Styling

Tailwind CSS v4 + daisyUI v5. Theme is defined in `src/styles/global.css` via daisyUI token overrides. Themes switch via `data-theme="chirpy-light"` / `data-theme="chirpy-dark"` on `<html>`. Expressive Code uses corresponding themes (`github-light` / `github-dark-dimmed`). Fonts are loaded via Astro's Fonts API (Source Sans 3, Lato, JetBrains Mono).

### Markdown Processing

Configured in `astro.config.mjs` via `unified` pipeline: `remark-gfm` → `remark-math` → `remark-alert` → `remark-ashtml`, then `rehype-katex` → `rehype-slug` → `rehype-autolink-headings` → `rehype-external-links`. Expressive Code handles syntax highlighting inside both `.md` and `.mdx` files.

### Build & Deploy

`bun run build` runs `astro build` followed by `bun run pagefind` (indexes `dist/`). GitHub Pages deployment uses `BASE_PATH` env var (set to `/bitnpc.github.io` or similar in CI) so asset URLs resolve correctly. Dev server always runs at `/` for simplicity.

## Key Conventions

- **Path imports**: Use `@components/*`, `@layouts/*`, `@i18n/*`, `@utils/*`, `@styles/*`, `@content/*`, `~/*` aliases (defined in `tsconfig.json`).
- **Locale in URLs**: Never hardcode locale prefixes — use `localizedPath()` and `withBase()`.
- **Content images**: Put post images under `src/assets/images/posts/post-YYYY-MM-DD/` and reference them via relative paths in the markdown's `heroImage` frontmatter (Astro image pipeline optimizes them).
- **OG images**: Generated at build time via the `/og/[...slug].png` endpoint using Satori. The `autoOgImage` flag in config controls whether posts without `heroImage` get auto-generated OG images.
- **Frontmatter**: All posts/pages share a Zod schema from `content.config.ts`. Key fields: `draft`, `pinned`, `unlisted`, `math`, `toc`, `comments`, `translationKey`.
