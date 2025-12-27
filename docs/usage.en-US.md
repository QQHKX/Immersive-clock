# Usage Guide (English)

This document explains Immersive Clock features, operations, and details. Use the HUD and Settings Panel on the main interface to control features.

## Contents

- Quick Start
- Mode Switching & HUD
- Countdown
- Stopwatch
- Study Mode
- Settings Panel
- Weather
- Noise Monitoring & Reports
- Motivational Quotes & Channel Management
- Schedule Management
- PWA Install & Offline
- FAQ (Brief)

## Quick Start

- Click anywhere or press `Space / Enter` to show the HUD.
- Use the HUD to switch modes: Clock, Countdown, Stopwatch, Study.
- HUD auto-hides in around 8 seconds; click or press again to show.

## Mode Switching & HUD

- Click blank area or press `Space / Enter` to toggle the HUD.
- The HUD provides mode switching, author info, and settings entry.
- Accessibility: semantic roles and labels for keyboard users.

## Countdown

- Double-click the time display (or double-tap on touch devices) to open countdown settings.
- Configure hours, minutes, seconds; or choose a preset (10 min, 30 min, 1 h, 1 h 15 m, 2 h).
- Keyboard: `Enter` to confirm/start, `Esc` to close.
- Sound cues: last 5 seconds use `public/ding-1.mp3`; end chime `public/ding.mp3`.
- Visual consistency: numbers stay white under normal state.

## Stopwatch

- Select “Stopwatch” in the HUD to enter stopwatch mode.
- Start, pause, and show accumulated duration with a clean UI.

## Study Mode

- Top-left: Noise monitor (requires microphone permission).
- Top-right: Target year or custom event countdown, and motivational quotes.
- Center: Large current time and date, ideal for projection/classroom.
- Reports: Auto-generated noise report near session end; manually close or view history.

## Settings Panel

- Open settings in Study mode via the Settings button.
- Basic settings:
  - Countdown type: Gaokao target year or custom event (name & date).
  - Target year range: current year to +10 years.
- Weather settings:
  - Manual refresh; show city, temperature, humidity, wind, and more.
  - Data source priority: Browser Geolocation → AMap IP → other IP; main weather provider: HeWeather.
- Noise settings:
  - Microphone calibration and baseline slider.
  - Auto pop report (on by default), preferences are persisted.
- Quote settings:
  - Channel management (kept: Literature, Poetry, Philosophy, Witty Lines); configurable refresh interval.
- Schedule:
  - Add/Edit/Delete sessions; persisted to local storage.

## Weather

- Weather component shows city location and multiple real-time parameters.
- If location is denied, it falls back to IP-based sources.
- Manual refresh in settings to get the latest weather.

## Noise Monitoring & Reports

- Requires microphone permission; shows current noise level and status.
- Generates statistical reports before session end: average, peak, alerts count, noisy duration.
- History dialog with dual-scroll columns and chart threshold lines.

## Motivational Quotes & Channel Management

- Multiple sources with adjustable refresh interval.
- Online channels simplified to Literature, Poetry, Philosophy, and Witty Lines.

## Schedule Management

- Manage schedule in the Settings Panel; data is saved in local storage.
- Suitable for campus projection and fixed-session study.

## PWA Install & Offline

- Installable to desktop/home screen; works offline with auto updates.
- Dedicated cache strategies for images/fonts/audio; docs (`/docs/*.md`) use NetworkFirst.

## FAQ (Brief)

- City location missing? Check browser permission or use manual refresh.
- No noise data? Ensure mic is granted and device supports it.
- HUD not appearing? Make sure no modal is open; click or press `Space/Enter`.
