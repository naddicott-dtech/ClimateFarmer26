# Climate Farmer

A browser-based educational simulation where students role-play as California farmers across 30 years, making season-by-season decisions as climate impacts challenge their operations.

## Play

Open in any modern browser (optimized for Chromebooks):
https://naddicott-dtech.github.io/ClimateFarmer26/

## Playtest Logging

To capture detailed logs during a play session, open the browser console (F12 or Cmd+Shift+J) and run:

```js
// Enable logging (persists until you disable it)
localStorage.setItem('playtestLog', '1')
```

Refresh the page, then play normally. Green `[PLAYTEST]` entries will appear in the console showing commands, events, harvests, and year-end summaries.

When done, copy the full log to your clipboard:

```js
copy(window.__exportPlaytestLog())
```

Paste into a text file or share directly. To disable logging:

```js
localStorage.removeItem('playtestLog')
```

## Development

```bash
npm install
npm run dev          # Dev server (localhost:5173)
npm run build        # Production build
npm test             # Unit tests (451)
npm run test:browser # Playwright browser tests (84)
```
