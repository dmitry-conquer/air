# Express Starter

A modern frontend starter for building multi-page websites and WordPress themes. It combines Vite, Tailwind CSS, Handlebars, Alpine.js, and TypeScript in a lightweight development setup.

## Features

- Fast development and production builds with Vite
- Tailwind CSS v4 with a CSS-first theme configuration
- Reusable Handlebars components with automatic live reload
- Multi-page architecture with automatic page discovery
- Alpine.js components and plugins bundled through module imports
- Smooth scrolling with Lenis
- Utility-based animations with TAOS
- TypeScript, ESLint, and Prettier configuration
- Build output organized for straightforward CMS integration

## Getting Started

Requirements: Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

Open the local URL shown by Vite. The main development page is available at `/pages/index.html`.

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm host` | Start the server and expose it to the local network |
| `pnpm build` | Type-check and create a production build |
| `pnpm preview` | Preview the production build locally |

## Project Structure

```text
components/          Reusable Handlebars partials
pages/               HTML page entry points
public/              Static assets copied as-is
src/scripts/main.ts  Main TypeScript entry point
src/styles/main.css  Tailwind imports and theme configuration
dist/                Generated production build
vite.config.js       Pages, templates, plugins, and output settings
```

## Working with Pages and Components

Add HTML files to `pages/` to create new build entries. Vite discovers them automatically.

Reusable markup belongs in `components/` and can be included as a Handlebars partial:

```html
{{> header}}
{{> footer}}
```

Tailwind scans both directories for utility classes. Global styles and design tokens can be configured in `src/styles/main.css`.

## Production Build

```bash
pnpm build
```

The generated files are written to `dist/`. HTML pages are moved to the root of the output directory, while scripts, styles, fonts, and other assets are grouped under `dist/assets/`.
