# Squeek Runner

An original, playable pixel-art hamster arcade built with React, TypeScript and Phaser 3. Tap to run, hold to charge, and release near the bright band for a clean flip. Five consecutive landings trigger ten seconds of Fever.

The finished static website is in **`dist/`**. It works at a gateway subpath, uses hash navigation and bundles its fonts, sprites, icons and share image locally.

## Install and play locally

Use Node.js 22.12+ (Node 24 was used for validation) and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. No wallet, API key, database or server is needed to play.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` rebuilds `dist/`. `npm run preview` serves that production export. Deploy the **contents of `dist/`** to any static host or IPFS gateway. Vite's `base: './'` keeps asset references relative. There are no rewrite rules or server routes to configure for the static game. Do not deploy the source tree, dependencies or test output.

## Controls and rules

- **Tap / click:** press the wheel or sprint button briefly. Each accepted tap earns 1 Score, virtual Power and distance. Inputs have a short cooldown.
- **Hold / release:** hold the wheel, sprint button or Space. Release around **72%** of the 1.8-second charge bar. The bright band marks the ideal window; the wider band allows Nice landings. A maximum hold launches automatically.
- **Landing:** gravity, flight time, angular rotation, impact speed and stability determine Miss, Nice or Perfect. Nice starts at 40 points; Perfect at 100, before combo and upgrade bonuses. A miss clears the combo and leaves earned points intact.
- **Fever:** five consecutive clean landings start 10 seconds of double landing points. Its timer pauses with the game. Further streak milestones can start another Fever after the current one expires.
- **Keyboard:** Space supports taps and holds on the game; Space and Enter activate focused utility buttons. Tab navigates controls. Escape closes dialogs.
- **Pause / sound:** controls sit in the game scene. Sound is opt-in. Leaving the tab or opening another screen pauses play; resume explicitly when ready.

Score is a spendable game balance. Lifetime Score remains a record even after purchases. Accumulated virtual Power unlocks upgrade tiers: levels 1–5 require 25, 100, 250, 500 and 1,000 Power respectively. Every upgrade type uses the same thresholds, and its row shows the required and current Power. Power is never spent; Score remains the purchase currency for upgrades and cosmetics. Existing upgrades and owned cosmetics are retained. Neither value is SQK, real mining work or an official Squeekchain balance.

## Completed MVP

- Original underground pixel-art scene, mechanical wheel, gravity-driven flips and pixel particles.
- Five original hamster sprite sheets, each with **43 frames** across idle, running, fast running, charging, jumping, airborne rotation, landing, perfect landing, failure and Fever animations. Every animation has multiple distinct pixel frames.
- Tap, long press, release, keyboard controls, charge feedback, three landing results, combos and Fever countdown.
- Opt-in synthesized arcade sounds, reduced-motion treatment and automatic background pause.
- Persistent local Score, Power, distance, best combo, perfect landings, daily records, five upgrade types and five cosmetic hamsters.
- Local daily / rolling seven-day Score, distance and combo records, with an honestly labeled shared-board offline state.
- Read-only official Squeekchain status, core, economy, account and Squeek lookups, schema validation, background-aware polling, timeouts and rate-limit handling. All official readings are identified as **Sepolia testnet**.
- Optional Wagmi/Viem wallet picker: EIP-6963 browser wallets including MetaMask, Coinbase Wallet / Smart Wallet and mobile wallet-browser links for MetaMask, Coinbase, Rabby and Phantom. Short address, disconnect and Sepolia switching states are implemented.
- Node/Express and PostgreSQL score service, migration, secure guest sessions, server replay, timing checks, one-use runs, request limits, persistent verified progression and four shared leaderboard metrics.
- A configurable ranked-run UI, with standard equipment, server-validated submission and recovery from unavailable or expired runs.

## Official data

Source: [Squeekchain](https://squeekchain.com/), [developer documentation](https://docs.squeekchain.com/) and `https://api.squeekchain.com/v1`.

| Resource              | Polling                                         | Usage                                                                            |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `/status`             | 15 seconds while dashboard is open              | Real hardware RPM, status, freshness and sensor cumulative work                  |
| `/core`               | 30 seconds                                      | Settled block height, progress and cumulative work                               |
| `/economy/state`      | 60 seconds while dashboard is open              | SQK live supply, mining issuance and cap                                         |
| `/accounts/{address}` | 60 seconds when connected and dashboard is open | Account power, claimable testnet SQK, ownership counts and first page of Squeeks |
| `/squeeks/{tokenId}`  | 60 seconds after a lookup                       | Ownership, level, base power and metadata name                                   |

Polling stops in background tabs. Requests time out after eight seconds; 429 responses use a bounded Retry-After delay of 15 seconds to 15 minutes. Each endpoint keeps its own deadline across navigation and observers. If the API does not expose Retry-After to browser JavaScript, the app uses a 60-second fallback. Refresh retries only eligible endpoints, so another endpoint’s error cannot bypass a cooldown. Submitting the same normalized Squeek ID retries a failed lookup when eligible and shows its loading state; rate-limited lookups remain disabled until their deadline. Failed or unexpected responses show unavailable/stale states instead of generated numbers. Integer chain quantities are validated as strings and formatted with BigInt. Unsupported deployment chain IDs are rejected.

Account NFT lists explicitly show when only the first API page is loaded. Official NFT art is not copied into the arcade collection. The real hardware RPM does not follow player clicks.

## Optional wallet configuration

No wallet is needed for gameplay. The default export requires no relay or project ID: desktop extensions use EIP-6963, mobile links open this same page in a wallet's browser, and Coinbase provides its own connector.

An operator with an existing WalletConnect project may set **`VITE_WALLETCONNECT_PROJECT_ID` at build time** to add its QR connector. It is deliberately omitted from the default export. This public project identifier is not a private key. There are no signing, minting, approval or transfer actions in this application.

## Optional shared score service

The static export defaults to local records. To enable ranked play, deploy the included service with PostgreSQL and rebuild with `VITE_SCORE_API_URL`. A static gateway cannot run Node or PostgreSQL itself.

1. Provision PostgreSQL 15+ and set `DATABASE_URL` to its connection URL in the server's runtime environment.
2. Run `npm ci`, then `npm run db:migrate`.
3. Set `SCORE_ORIGIN` to the exact frontend origin, including scheme and port if applicable. Set `NODE_ENV=production` for HTTPS deployment. `PORT` defaults to 3001.
4. Run `npm run server` behind HTTPS. Prefer a same-origin reverse proxy that forwards `/api/*` to this service. The process has no blockchain keys.
5. Rebuild the frontend with the service URL. For a same-origin proxy:

```sh
VITE_SCORE_API_URL=/api npm run build
```

For local full-stack development, use `SCORE_ORIGIN=http://localhost:5173` on the score service and `VITE_SCORE_API_URL=/api npm run dev` for the frontend. Vite proxies `/api` to port 3001.

If an HTTPS API is on a different site, use its full `/api` URL as `VITE_SCORE_API_URL`, set `SCORE_CROSS_SITE=1` on the server and configure `SCORE_ORIGIN` precisely. This uses Secure, SameSite=None cookies; browsers that block third-party cookies may prevent that arrangement. A same-origin proxy avoids this limitation.

| Endpoint                            | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `GET /api/health`                   | Database readiness                                              |
| `POST /api/session`                 | Create or recover an HttpOnly guest session                     |
| `POST /api/runs`                    | Issue a new run; invalidate that guest's previous active run    |
| `POST /api/runs/:id/finish`         | Validate actions, replay scoring and atomically consume the run |
| `GET /api/profile`                  | Read this guest's verified persistent statistics                |
| `GET /api/leaderboard?metric=daily` | `daily`, `weekly`, `distance` or `combo` rankings               |

The server accepts action types, bounded timestamps and charge durations. It never accepts a claimed score, landing result, multiplier or upgrade level. It checks overlapping flights, input rates, completed landings, server elapsed time and expiration. PostgreSQL transactions, row locks and a unique run ID prevent repeated awards. Guest session tokens are random; only hashes are stored. Writes require the configured Origin. Request bodies and rates are limited.

Ranked play uses baseline equipment for everyone. Local upgrades and cosmetics remain local. Verified points and statistics persist on the server under an anonymous guest session, separately from unverified local records. Wallet connection is not an identity or recovery mechanism for the score service.

## Validation

The production build, strict typecheck, gameplay and PostgreSQL tests, browser interactions, accessibility checks and the pinned design probe were run locally. Actual commands, outcomes, fixes, screenshots and environment limitations are recorded in [artifacts/validation.md](artifacts/validation.md). The implemented visual system is documented in [DESIGN.md](DESIGN.md).

Recorded results: **20 tests**, **21 gameplay/browser checks**, **7 failure/wallet/orientation checks**, **7 focused revision checks**, **16/16 design-probe checks**, zero axe violations on the five phone screens, and a successful ranked frontend/service/SQL round trip. The 390×844 first screen includes the main action. WebKit could not launch because native libraries were missing; PostgreSQL service checks used PGlite rather than an external database.

To run browser checks on another machine:

```sh
npx playwright install chromium
npm run build
npm run test:browser
npm run test:states
npm run test:revision
```

The browser script serves the export at `/preview/`, exercises gameplay and all screens, and writes temporary evidence to `test/scratch/browser-check/`. Internet access is needed for its real official-API check. Set `SQUEEK_ENGINE=webkit` after installing WebKit to repeat it in that engine. Native browser libraries must be installed on the host.

The revision checks cover utility-button Space activation, earned Power unlocking upgrades, mixed API errors, retry deadlines across navigation, and same-ID lookup recovery. These tests use clearly identified local fixtures, never manufactured live readings. The distance service regression submits a real tap-only run against embedded PostgreSQL and verifies its 0.35 m entry on daily, weekly and distance boards, while preserving separate combo eligibility.

The additional state checks simulate API failures, rate limits, unavailable storage, an EIP-6963 provider and phone rotation. To exercise the optional ranked UI against the included service and embedded PostgreSQL:

```sh
VITE_SCORE_API_URL=/api npm run build -- --outDir test/scratch/ranked-dist
npm run test:ranked
```

This alternate test export leaves the default `dist/` intact. The pinned design probe is assignment input and is not distributed; its final report is retained with the validation evidence. All five reopened findings, their reproduction evidence and fixes are recorded in `.imd-responses.json` and `artifacts/validation.md`.

## Remaining limitations

- The delivered static export has **local progression and local records**. Shared rankings require deploying the included service and configuring its URL. No hosted database or score service is bundled into a static page.
- Upgrades and cosmetics do not sync between devices. Clearing browser data clears local progress. A guest score-service cookie is tied to that browser and is not a recoverable wallet login.
- Server checks prevent invalid scoring and simple replay; they do not prove a human supplied legally timed inputs. Bot resistance, moderation, authenticated accounts and shared rate-limit storage for multiple server replicas remain production work.
- Account NFT pagination currently reads the first page. There are no onchain game rewards, SQK minting, transfers or NFT transactions.
- Real extension approval, Coinbase passkey onboarding, mobile app deep-link handoff, WalletConnect QR sessions, physical iOS/Android devices and assistive-technology sessions have not been certified. WebKit could not start in this environment because native browser libraries were missing.
- PostgreSQL SQL and service flows were exercised using PGlite's embedded PostgreSQL engine. External PostgreSQL connectivity, multi-process concurrency and a production reverse proxy remain deployment checks.

## Assets and attribution

`npm run art` regenerates the original pixel sprites, portraits, favicon and share card using only Node built-ins. The mine scene is drawn in `src/game/MiningScene.ts`. Artwork was created for this game and does not copy official Squeek NFT characters.

Silkscreen and Space Grotesk are bundled under the SIL Open Font License. Wallet marks are from RainbowKit (MIT) and retain their brand colors. Notices are in `public/licenses/` and copied into `dist/licenses/`.

The design workflow used the supplied Better Interface reference, adapted from Jakub Krehel's Better Interface (MIT), and Paul Bakaus's Impeccable documentation guide (Apache-2.0). Their license texts are retained in `artifacts/design-guidance-LICENSE.txt`.
