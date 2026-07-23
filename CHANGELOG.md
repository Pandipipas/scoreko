# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.1] - 2026-07-23

### Added

- **Tournament Hub & Live Bracket Management (`/tournament-hub`):**
  - Introduced a comprehensive Tournament Hub view allowing organizers to search, attach, and manage live tournament brackets from **start.gg** and **Challonge**.
  - **Active Match Banner:** Live match control header with tools to push player data to the scoreboard, swap player sides, adjust scores, and report set results directly back to start.gg/Challonge.
  - **Bracket View & Match Cards:** Visual card interface displaying seeds, player avatars, score status (Upcoming, In Progress, Complete), and quick action controls.
  - **Quick Matches Panel:** Streamlined sidebar for quick-assigning upcoming stream matches directly to the scoreboard.
  - **`attachedBracket` Replicant & Schema:** Replicant state system for synchronizing attached bracket state across dashboard components and overlay graphics.

- **Internationalization (i18n):**
  - Added full **Spanish (`es.json`)** language localization alongside English (`en.json`), with dynamic language switching in the dashboard.

- **Custom Overlay Typography:**
  - Bundled custom fonts (`Bebas Neue`, `Gilroy ExtraBold`, `M PLUS Rounded 1c`) and CSS font descriptors into `opeik/runback` commentary and scoreboard graphic overlays.

- **Start.gg Rate Limiter & Request Cache:**
  - Added a token-bucket rate limiter (`rate-limiter.ts`) and response cache (`request-cache.ts`) to handle start.gg GraphQL API limits gracefully and reduce network latency.

- **Backend Verification & Safety Suite:**
  - Added SSRF URL safety validation (`validatePacksUrl` in `util/helpers.ts`) and backend test suite (`verify.test.ts`) testing rate limiting, request caching, URL safety, and Challonge v1 Auth encoding.

- **Asset Packs Updates (`scoreko-packs`):**
  - Added and updated asset packs with headers, hero images, logos, and character rosters:
    - **2XKO:** Added header, hero, and logo images.
    - **Vampire Savior:** Added Vampire Savior pack assets.
    - **Virtua Fighter 5 R.E.V.O. World Stage:** Added game pack assets.
    - **BlazBlue Central Fiction:** Added game pack assets.
    - **Dragon Ball FighterZ:** Added game pack assets.
    - **Fatal Fury: City of the Wolves:** Added Kenshiro, Mr. Karate III, and game pack assets.
    - **Granblue Fantasy Versus: Rising:** Added game pack assets.
    - **Invincible VS:** Added Immortal and Universa, sorted character roster alphabetically.
    - **Rivals of Aether II:** Added game pack assets.
    - **Street Fighter 6:** Added Yasmine and updated logo images.
    - **Tekken 8:** Updated banner, header, hero, and logo images.

### Changed

- **Asset Packs Architecture (`scoreko-packs`):**
  - Replaced `packVersion` in favor of `gameVersion` across all pack registries and manifests.
- **Dashboard UI Redesign:**
  - Replaced legacy navigation layout with modern glassmorphism panels, modular SASS styling (`glass-panel.scss`, `panel-header.scss`, `buttons.scss`), and tabbed UI navigation.
- **Score Center & Player Management:**
  - Redesigned `ScoreCenterPanel.vue`, `PlayerSidePanel.vue`, and `Players.vue` with start.gg/Challonge profile search, country pickers, and interactive character selectors.
- **Commentary Panel:**
  - Redesigned commentator management controls with character avatar previews, quick clear triggers, and side-swap capabilities.
- **Graphics Settings Schema (`graphicsSettings.json`):**
  - Added `locale` property (`en` | `es`) to `graphicsSettings` schema for multi-language overlay synchronization.
- **Extension API Integrations (start.gg & Challonge):**
  - Refactored set reporting workflows, automated token management, state validation, and error reporting.
- **Asset Packs Engine:**
  - Improved SHA-256 integrity verification, local asset serving, and non-blocking download queues.

## ~~[0.2.2] - 2026-07-16~~ *(Legacy)*

### Changed
- **License:** Updated remaining MIT license references across all project files to GPL-3.0.

### Fixed
- **Dashboard:** Fixed image URL resolution for newly added characters when updating asset packs.

## ~~[0.2.1] - 2026-07-14~~ *(Legacy)*

### Changed
- **License:** Project license has been changed from MIT to GPL-3.0.

### Fixed & Security

**Security Improvements:**
- **Local Server Restrictions:** The internal NodeCG server is now strictly bound to `localhost` to prevent unauthorized external network access.
- **OAuth Token Storage:** Migrated user OAuth tokens to a secure, server-side encrypted storage.
- **Asset Pack Validation:** Implemented SHA-256 integrity checks for all downloaded asset packs to ensure their contents haven't been tampered with.
- **XSS Prevention:** Added proper HTML escaping in OAuth error callbacks and the wrapper's changelog window to prevent Cross-Site Scripting vulnerabilities.
- **File System Safety:** Enforced a strict MIME type whitelist for served pack files and added input sanitization for pack IDs to prevent unsafe file system operations.
- **OAuth Proxy:** Hardcoded the official OAuth proxy URL to prevent redirection vulnerabilities.

**Bug Fixes & Stability:**
- **Dashboard:** Added network timeouts and response validation when fetching new releases from GitHub to prevent the dashboard from hanging.
- **Packs Server:** Fixed issues with absolute path resolution to ensure accurate serving of local assets.
- **First-Boot Setup:** Fixed a bug where closing the application during the initial setup would incorrectly bypass the setup UI on subsequent launches.
- **Memory Management:** Ensured temporary player cleanup intervals in the dashboard are properly disposed, and cleared dangling SIGKILL fallback timers in the wrapper to prevent resource accumulation.
- **Auto-Updater:** Resolved an issue where multiple UI event listeners were registered simultaneously for the same update check.

**Performance Optimizations:**
- **Application Startup:** Parallelized the Electron wrapper and NodeCG extension loading sequences, deferred heavy module imports, and migrated all synchronous file system operations to asynchronous I/O (`fs.promises`) to drastically reduce "cold boot" latency.
- **Installer & Footprint:** Removed unnecessary NodeCG development dependencies from the final release, excluded unused Chromium locales, and optimized the cross-compilation pipeline, substantially reducing the Windows installer and application size.
- **UI Payload:** Implemented dynamic route imports for Vite code-splitting and converted large PNG assets to WebP, significantly decreasing the initial load size of the dashboard.
- **Non-blocking Operations:** Migrated the packs downloading logic, SHA-256 integrity checks, and local registry fetching to use asynchronous I/O, preventing the Node.js event loop from freezing during large pack installations.
- **Documentation:** Added troubleshooting guidance regarding potential slow first-boots caused by external Antivirus scans.

## ~~[0.2.0] - 2026-07-11~~ *(Legacy)*

### Added

- Swap Sides shortcut: `S` key (configurable) swaps players and their scores on the scoreboard.
- Packs Manager flags newly added characters by comparing the remote manifest against the local install.
- Packs Manager shows the game version alongside the asset pack version.

### Changed

- Auto-updater rebuilt on `electron-updater`, with a changelog window on update.
- Settings reworked with tab navigation, synced to the URL.
- Challonge manual connection steps rewritten, dropping OAuth terminology.
- Players section links directly to the relevant Settings integration tab.
- About page redesigned, with initial translation support for that screen.
- Default asset packs repository URL updated.

## ~~[0.1.0] - 2026-07-06~~ *(Legacy)*

### Added

- Scoreboard and commentator overlays for OBS.
- Player lookup via start.gg and challonge.
- Downloadable games assets packs from remote repositories.
- Standalone `.exe` build.
- Dashboard to manage overlays.

[Unreleased]: https://github.com/Pandipipas/scoreko/compare/v1.0.0-alpha.1...HEAD
[1.0.0-alpha.1]: https://github.com/Pandipipas/scoreko/compare/v0.2.2...v1.0.0-alpha.1
~~[0.2.2]: https://github.com/Pandipipas/scoreko-old/compare/v0.2.1...v0.2.2~~
~~[0.2.1]: https://github.com/Pandipipas/scoreko-old/compare/v0.2.0...v0.2.1~~
~~[0.2.0]: https://github.com/Pandipipas/scoreko-old/releases/tag/v0.2.0~~
~~[0.1.0]: https://github.com/Pandipipas/scoreko-old/releases/tag/v0.1.0~~