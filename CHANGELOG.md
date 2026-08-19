# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-08-19

### Added

- **Scoreko Dashboard:**
  - **Tournament Hub:** Added a refresh button to the header and a loading spinner indicator when actively refreshing bracket matches.
  - **Tournament Hub:** Highlighted the active stream match across bracket match cards.

### Changed

- **Scoreko Dashboard:**
  - **Country Selection:** Simplified and unified country selection handling across all player and settings panels.
  - **Flags:** Optimized `flags.ts` and improved tree-shaking by integrating `country-list`.
  - **Design System:** Standardized design tokens, layout metrics, and CSS utility classes (`glass-panel.scss`, `panel-header.scss`, `theme.scss`).
- **Scoreko Extension:**
  - **Node.js ESM Migration:** Migrated extension codebase to native Node.js ES Modules (`NodeNext`).
  - **Error Boundaries:** Added structured error boundaries and `try/catch` wrapping across all RPC message handlers with `sendAck`.

### Fixed

- **Scoreko Dashboard:**
  - **Packs:** Added case-insensitive and prefix character search in pack character selectors.
  - **Tournament Hub:** Preserved player country flag when pushing bracket matches to the scoreboard.
  - **Tournament Hub:** Fixed reactivity loss on bracket quick matches and match cards when updating replicants.
  - **Settings:** Fixed manual game name field auto-population.
- **Scoreko Graphics:**
  - **Overlays:** Resolved `font-family` CSS variable inheritance issues in OBS browser source overlays.

---

## [0.5.0] - 2026-08-08 *(Legacy)*

### Added

- **Scoreko Dashboard & Extension:**
  - **Graphics:** Optimized graphics view with a toggleable live overlay preview.
  - **Players:** Overhauled player database management and smart import, with a configurable default country setting.
  - **Integrations:** Added persistent connections, retry backoffs, and asset fallback packs for start.gg and Challonge.
  - **Notifications:** Standardized notification presets, eliminated duplicates, and achieved 100% i18n parity.
  - **Overlays:** Optimized font rendering, FitText scaling, and dynamic caster layout support.
  - **UI/UX:** Implemented fluid micro-interactions and panel transitions.

### Changed

- **Scoreko Dashboard:**
  - **Layout:** Standardized max-width in Players and Graphics views and unified top padding across all views.
  - **Tournament Hub:** Restored default glass panel styling and unified layout structure.
  - **UI/UX:** Implemented smooth dashboard and sidebar animations.

### Fixed

- **Scoreko Dashboard & Backend:**
  - **Layout:** Resolved vertical stretching and spacing inconsistencies in dashboard panels.
  - **Packs:** Trapped async errors in pack download and update handlers.
  - **Build:** Excluded test files from extension bundle build.
  - **Graphics:** Self-closed iframe preview element in the Graphics view.
- **Scoreko Wrapper:**
  - **Window Resolution:** Removed auto-zoom listener and enforced minimum window resolution of 1600x900.
  - **Path Resolution:** Supported adaptive bundle root resolution for sibling repositories.
  - **Security:** Added auto-updater modules to security surface allowlist.

### Documentation

- Added UI showcase and screenshots to `README.md`.
- Added intellectual property notices and trademark disclaimers to `LICENSE`.

---

## [0.4.0] - 2026-08-01 *(Legacy)*

### Added

- **Scoreko Dashboard & Extension:**
  - **Toast Notifications:** Added a centralized toast notification system.
  - **Overlay Preview:** Added a live overlay preview iframe in the Graphics view.
  - **API Status:** Added API status badges to the sidebar and exposed authentication status via a new replicant.
  - **CI/CD:** Added a build pipeline with lint, typecheck, and build checks.
  - **Documentation:** Expanded `CONTRIBUTING.md` with detailed development guides and referenced it in `README.md`.

### Changed

- **Scoreko Backend & Architecture:**
  - **Message Middleware:** Implemented `createHandler` middleware for robust message validation and error handling.
  - **Caching:** Replaced the FIFO participant cache with an LRU cache with eviction policies (`maxEntries`).
  - **Module Splitting:** Split `startgg`, `challonge`, and `packs` into independent, focused modules.
  - **GraphQL:** Extracted GraphQL queries into a dedicated `queries.ts` file.
  - **Type Safety & Refactoring:** Extracted `start.gg` response types and consolidated shared pack types. Moved Vue reactivity out of `shared/` to `browser_shared/`.
  - **Confirm Dialogs:** Upgraded confirmation prompts in the dashboard to use native Quasar dialogs.
  - **Locales:** Refined English and Spanish translations, migrating locale structures to TypeScript modules with section headers.
- **Scoreko Wrapper:**
  - Translated static HTML loading and error pages to English.
  - Unified wrapper static HTML page styling with the main Scoreko *glass panel* design.

### Fixed

- **Scoreko Backend Security:**
  - Hardened `validatePackId` to prevent path traversal vulnerabilities.
  - Moved the encryption key out of the NodeCG bundle directory.
  - Indexed OAuth sessions by state for `O(1)` lookup.
- **Scoreko Wrapper:**
  - Prevented the loading progress bar from visually jumping backwards.

---

## [0.3.0] - 2026-07-23 *(Legacy)*

### Added

- **Scoreko Dashboard & Extension:**
  - **Tournament Hub:** Introduced the Tournament Hub view (`/tournament-hub`) to search, attach, and manage live brackets from **start.gg** and **Challonge**.
  - **Match Controls:** Added Active Match Banner to push player data to overlays, swap sides mid-match, update scores, and report set results directly.
  - **Bracket View:** Added visual card interface displaying seeds, player avatars, score status (Upcoming, In Progress, Complete), and quick action controls.
  - **Quick Matches Panel:** Streamlined sidebar for quick-assigning upcoming stream matches directly to the scoreboard.
  - **`attachedBracket` Replicant:** Centralized state synchronizing attached bracket data across dashboard components and overlay graphics.
  - **Internationalization (i18n):** Full Spanish (`es.json`) language localization alongside English (`en.json`), with dynamic language switching.
  - **Packs View:** Added dedicated `Game v{version}` and `Pack v{version}` visual badges on pack cards.
  - **Rate Limiting & Caching:** Added a token-bucket rate limiter (`rate-limiter.ts`) and response cache (`request-cache.ts`) for start.gg GraphQL API requests.
  - **Safety Suite:** Added SSRF URL safety validation (`validatePacksUrl` in `util/helpers.ts`) and backend test suite.
- **Scoreko Graphics:**
  - **Custom Typography:** Bundled custom fonts (`Bebas Neue`, `Gilroy ExtraBold`, `M PLUS Rounded 1c`) and CSS font descriptors into `opeik/runback` and `opeik/commentary` overlays.
- **Game Asset Packs (`scoreko-packs`):**
  - Added and updated asset packs with headers, hero images, logos, and character rosters for: *2XKO*, *Vampire Savior*, *Virtua Fighter 5 R.E.V.O. World Stage*, *BlazBlue Central Fiction*, *Dragon Ball FighterZ*, *Fatal Fury: City of the Wolves* (added Kenshiro & Mr. Karate III), *Granblue Fantasy Versus: Rising*, *Invincible VS* (added Immortal & Universa), *Rivals of Aether II*, *Street Fighter 6* (added Yasmine), and *Tekken 8*.

### Changed

- **Scoreko Dashboard:**
  - **UI Redesign:** Replaced legacy layout with modern glassmorphism panels, modular SASS styling (`glass-panel.scss`, `panel-header.scss`, `buttons.scss`), and tabbed UI navigation.
  - **Player & Score Controls:** Redesigned `ScoreCenterPanel.vue`, `PlayerSidePanel.vue`, and `Players.vue` with profile search, country pickers, and interactive character selectors.
  - **Commentary Panel:** Redesigned commentator controls with character avatar previews, quick clear triggers, and side-swap capabilities.
- **Scoreko Extension & Overlays:**
  - **Graphics Settings Schema:** Added `locale` property (`en` | `es`) to `graphicsSettings` schema for multi-language overlay synchronization.
  - **Integrations:** Refactored set reporting workflows, automated token management, state validation, and error reporting for start.gg and Challonge.
- **Asset Packs Engine:**
  - Replaced `packVersion` in favor of `gameVersion` across pack registries and manifests.
  - Improved SHA-256 integrity verification, local asset serving, and non-blocking download queues.

### Fixed

- **Scoreko Dashboard:**
  - **Packs Manager:** Corrected computation logic for newly added characters during pack updates to prevent false positives when diffing local and remote character rosters.

---

## [0.2.2] - 2026-07-16 *(Legacy)*

### Changed

- **Scoreko Core:**
  - **License:** Updated remaining MIT license references across all project files to GPL-3.0.

### Fixed

- **Scoreko Dashboard:**
  - **Packs:** Fixed image URL resolution for newly added characters when updating asset packs.

---

## [0.2.1] - 2026-07-14 *(Legacy)*

### Changed

- **Scoreko Core:**
  - **License:** Project license has been changed from MIT to GPL-3.0.

### Fixed & Security

- **Security Hardening:**
  - **Local Server Restrictions:** The internal NodeCG server is now strictly bound to `localhost` to prevent unauthorized external network access.
  - **OAuth Token Storage:** Migrated user OAuth tokens to a secure, server-side encrypted storage.
  - **Asset Pack Validation:** Implemented SHA-256 integrity checks for all downloaded asset packs to ensure their contents haven't been tampered with.
  - **XSS Prevention:** Added proper HTML escaping in OAuth error callbacks and the wrapper's changelog window to prevent Cross-Site Scripting vulnerabilities.
  - **File System Safety:** Enforced a strict MIME type whitelist for served pack files and added input sanitization for pack IDs to prevent unsafe file system operations.
  - **OAuth Proxy:** Hardcoded the official OAuth proxy URL to prevent redirection vulnerabilities.
- **Bug Fixes & Stability:**
  - **Dashboard:** Added network timeouts and response validation when fetching new releases from GitHub to prevent the dashboard from hanging.
  - **Packs Server:** Fixed issues with absolute path resolution to ensure accurate serving of local assets.
  - **First-Boot Setup:** Fixed a bug where closing the application during the initial setup would incorrectly bypass the setup UI on subsequent launches.
  - **Memory Management:** Ensured temporary player cleanup intervals in the dashboard are properly disposed, and cleared dangling SIGKILL fallback timers in the wrapper to prevent resource accumulation.
  - **Auto-Updater:** Resolved an issue where multiple UI event listeners were registered simultaneously for the same update check.
- **Performance Optimizations:**
  - **Application Startup:** Parallelized the Electron wrapper and NodeCG extension loading sequences, deferred heavy module imports, and migrated all synchronous file system operations to asynchronous I/O (`fs.promises`) to drastically reduce "cold boot" latency.
  - **Installer & Footprint:** Removed unnecessary NodeCG development dependencies from the final release, excluded unused Chromium locales, and optimized the cross-compilation pipeline, substantially reducing the Windows installer and application size.
  - **UI Payload:** Implemented dynamic route imports for Vite code-splitting and converted large PNG assets to WebP, significantly decreasing the initial load size of the dashboard.
  - **Non-blocking Operations:** Migrated the packs downloading logic, SHA-256 integrity checks, and local registry fetching to use asynchronous I/O, preventing the Node.js event loop from freezing during large pack installations.
  - **Documentation:** Added troubleshooting guidance regarding potential slow first-boots caused by external Antivirus scans.

---

## [0.2.0] - 2026-07-11 *(Legacy)*

### Added

- **Scoreko Dashboard:**
  - **Scoreboard Controls:** Swap Sides shortcut: `S` key (configurable) swaps players and their scores on the scoreboard.
  - **Packs Manager:** Displays game version alongside pack version and flags newly added characters by comparing against remote manifests.

### Changed

- **Scoreko Dashboard & Extension:**
  - **Auto-Updater:** Rebuilt on `electron-updater`, with a changelog window on update.
  - **Settings:** Reworked with tab navigation, synced to the URL.
  - **Integrations:** Challonge manual connection steps rewritten, dropping OAuth terminology.
  - **Players:** Players section links directly to the relevant Settings integration tab.
  - **About:** About page redesigned, with initial translation support for that screen.
  - **Packs:** Default asset packs repository URL updated.

---

## [0.1.0] - 2026-07-06 *(Legacy)*

### Added

- **Overlays:** Scoreboard and commentator overlays for OBS.
- **Integrations:** Player lookup via start.gg and Challonge.
- **Asset Packs:** Downloadable game asset packs from remote repositories.
- **Desktop Wrapper:** Standalone executable build.
- **Dashboard:** Interactive dashboard to manage overlays and broadcast state.

---

> **Note:** Versions prior to `0.6.0` (`v0.1.0` – `v0.5.0`) correspond to the legacy repositories.

[0.6.0]: https://github.com/Pandipipas/scoreko/releases/tag/v0.6.0
[0.5.0]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v1.0.0-alpha.3
[0.4.0]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v1.0.0-alpha.2
[0.3.0]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v1.0.0-alpha.1
[0.2.2]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v0.2.2
[0.2.1]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v0.2.1
[0.2.0]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v0.2.0
[0.1.0]: https://github.com/Pandipipas/scoreko-legacy/releases/tag/v0.1.0