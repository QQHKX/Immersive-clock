<h1 align="center">
  <br/>
  <img src="public/favicon.svg" width="160" height="160" alt="Immersive Clock Logo" />
  <br/>
  Immersive Clock ⏰
</h1>

<p align="center">
  <a href="https://qqhkx.com">Website</a> ｜ <a href="https://github.com/QQHKX/immersive-clock">GitHub</a> ｜ <a href="https://clock.qqhkx.com">Live Demo</a>
</p>

<p align="center">
  <a href="./README.md">简体中文</a> ｜ English
</p>

<div align="center">

[![](https://img.shields.io/badge/version-3.13.0-blue.svg)](https://github.com/QQHKX/immersive-clock)
[![](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![](https://img.shields.io/badge/TypeScript-5.4.0-blue.svg)](https://www.typescriptlang.org/)
[![](https://img.shields.io/badge/Vite-5.4.0-646CFF.svg)](https://vitejs.dev/)
[![](https://img.shields.io/badge/Electron-39.2.7-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![](https://img.shields.io/badge/PWA-enabled-5A0FC8.svg)](https://web.dev/progressive-web-apps/)

</div>

<div align="center">
  <strong>Elegant time management, focused studying</strong>
</div>

> **⏸️ Maintenance Status**
>
> The project is currently on hold because the author is in the final year of high school. PRs/issues are welcome, but responses may be slow. Feel free to fork and maintain your own version.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Config & Caching](#config--caching)
- [Deployment](#deployment)
- [Accessibility](#accessibility)
- [Project Structure](#project-structure)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License & Author](#license--author)
- [Star History](#star-history)

---

## Overview

Immersive Clock is a lightweight desktop/web clock app built with React + TypeScript + Vite. It supports Clock, Countdown, Stopwatch, and Study Mode. It comes with weather, noise monitoring, motivational quotes, schedule management, and an announcement/changelog modal. With PWA, it works offline and updates automatically.

> Use cases: campus self-study, focused learning, Pomodoro, dashboard displays, desktop clock.

## Features

### Time Management Modes

- Switch among Clock / Countdown / Stopwatch / Study Mode
- HUD smart control: show on click or keypress, auto-hide in ~8s

### Study Dashboard

- Weather with manual refresh
- Noise monitoring: mic calibration, baseline adjustment, report & history
- Motivational quotes: channel management and refresh interval
- Target-year countdown (e.g., National Exam)

### Performance & UX

- Cache by asset type (images / fonts / audio)
- PWA: offline, auto updates, desktop install
- Accessibility (ARIA) and shortcuts (Space / Enter to show HUD)

---

## Quick Start

You can use Immersive Clock in multiple ways:

- Live demo (Web): https://clock.qqhkx.com
- Install as a PWA (Recommended): open the site in Chrome/Edge and click the “Install” button in the address bar/menu
- Desktop app (Electron): download installers from https://github.com/QQHKX/immersive-clock/releases

---

## Usage

- Mode switch: click page or press `Space/Enter` to show HUD
- Countdown: double-click time to configure; presets and chimes supported
- Stopwatch: start, pause, accumulate
- Study Mode: show weather, noise monitoring, quotes, and target-year countdown
- Settings Panel: adjust target year, noise baseline, quote refresh, schedule

More details:

- [Usage Guide (English)](docs/usage.en-US.md)
- [使用说明（中文）](docs/usage.zh-CN.md)
- [FAQ (English)](docs/faq.en-US.md)
- [常见问题（中文）](docs/faq.zh-CN.md)

---

## Config & Caching

- Env Vars
  - `VITE_APP_VERSION`: app version (defaults to `package.json`)
- Caching
  - Images/Fonts/Audio: `CacheFirst`
  - Docs: `NetworkFirst`
  - Ignore version param `v` for better offline experience

---

## Deployment

### Static Hosting Deployment (Recommended)

#### 🚀 Vercel (Recommended)

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/QQHKX/immersive-clock)

#### ☁️ EdgeOne Pages

[![Deploy with EdgeOne Pages](https://camo.githubusercontent.com/823c1cff835803f4f496377113449241c418079a84ba67a789068e643b74cb73/68747470733a2f2f63646e7374617469632e74656e63656e7463732e636f6d2f656467656f6e652f70616765732f6465706c6f792e737667)](https://edgeone.ai/pages/new?repository-url=https://github.com/QQHKX/immersive-clock)

> Use HTTPS to enable full PWA features.

### Docker Deployment

The project includes a Dockerfile for quick deployment:

---

## Accessibility

| Shortcut          | Action                     |
| ----------------- | -------------------------- |
| `Space / Enter`   | Show HUD                   |
| `Enter / Esc`     | Confirm / Close modals     |
| Double click time | Open countdown settings    |
| Double tap        | Mobile interaction support |

---

## Project Structure

```text
immersive-clock/
├── public/            # Static assets (icons, audio, PWA manifest, docs)
├── src/               # Source (components, styles, hooks, utils)
│  ├── components/     # UI and feature components
│  ├── hooks/          # Custom hooks (timer, fullscreen, audio)
│  ├── utils/          # Utilities and local storage managers
│  ├── styles/         # Global and variables CSS
│  └── pages/          # Pages
├── docs/              # Usage and FAQ
├── scripts/           # Post-build scripts (sitemap date updates)
├── vite.config.ts     # Vite config (PWA and version injection)
└── package.json       # Project metadata and scripts
```

---

## FAQ

- City location missing? Check browser permission or use manual refresh.
- No noise data? Ensure mic is granted and your device supports it.
- HUD not appearing? Make sure no modal is open; click or press `Space/Enter`.
- How to view announcement and changelog? Click the version at bottom-right or open the modal from menu.

More Q&A in [docs/faq.en-US.md](docs/faq.en-US.md).

---

## Contributing

We welcome all forms of contribution (feature enhancements, bug fixes, docs improvements).

- Contribution guide: [CONTRIBUTING.en-US.md](./CONTRIBUTING.en-US.md)
- Issues & suggestions: [Issues](https://github.com/QQHKX/immersive-clock/issues)

---

## License & Author

- License: GPL v3
- Author: **QQHKX**
  - 🌐 [Website](https://qqhkx.com)
  - 💻 [GitHub](https://github.com/QQHKX)

---

## Star History

<div align="center">
  <a href="https://star-history.com/#QQHKX/Immersive-clock" target="_blank">
    <img src="https://api.star-history.com/svg?repos=QQHKX/Immersive-clock&type=Date" alt="Star History Chart" />
  </a>
</div>
