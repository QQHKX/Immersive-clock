# FAQ

## Weather location not available?

- Ensure browser location permission is granted. If denied, the app falls back to IP-based location. You can manually refresh weather in Settings.

## No data in noise monitoring?

- Microphone permission is required. Check device support and allow microphone access in browser settings.

## HUD not visible or hides too fast?

- HUD auto-hides in ~8 seconds. Click anywhere or press `Space/Enter` to show again. If a modal is open (e.g., countdown settings), HUD won’t respond.

## No sound in countdown?

- Allow audio playback in the browser and disable system Do Not Disturb. The last 5 seconds play ticks (`public/ding-1.mp3`); end chime uses `public/ding.mp3`.

## How to manage schedules?

- In Study mode, click Settings and use the “Schedule” section to add/edit/delete. Data persists in local storage.

## PWA install fails or offline doesn’t work?

- Use a modern browser with HTTPS. Core assets are cached on first visit; updates auto refresh. If issues persist, clear site data and revisit.

## Can I customize quote sources?

- Online channels are simplified to Literature, Poetry, Philosophy, and Witty Lines. Adjust refresh interval in Settings.
