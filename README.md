# Family Menu (PWA, Firebase Firestore)

A simple installable web app to plan dinners, track configurable checkboxes, ratings, and notes — with history and settings. Uses your Firebase project `family-menu-38310`.

## Quick Start

1. **Serve locally** (any static server), e.g. with Python:
   ```bash
   cd family-menu-app
   python3 -m http.server 5173
   ```
   Then open http://localhost:5173/

2. **Deploy to Vercel (recommended)**:
   - Create a new project and import this folder.
   - No build step needed; framework preset: **Other** (static).
   - Ensure the files are served from the project root.

3. **Firestore Rules (current)**: test mode until 2025-09-01. Tighten later.

## Files

- `index.html` — UI + three tabs (Week, History, Settings)
- `styles.css` — simple dark theme
- `firebaseConfig.js` — your Firebase config (already filled in)
- `app.js` — Firestore read/write logic, week rendering, settings, history
- `manifest.webmanifest`, `service-worker.js` — PWA install & basic offline cache
- `assets/icon-192.png`, `assets/icon-512.png` — knife & fork icon

## Notes

- Push notifications are **not** included in this starter (requires FCM keys & more setup). The app is fully usable without push. We can add it later.
- Data model:
  - `config/global` → `checkItems`, `reminderTime`
  - `entries/{YYYY-MM-DD}` → `dinner`, `checks`, `rating`, `notes`