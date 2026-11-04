# Squeek Runner design system

## Overview

Squeek Runner is a playable hamster arcade for desktop and phone browsers. The visual direction is an original 16-bit underground mining facility: near-black green surfaces, mechanical pixel scenery, a warm hamster and lime power effects. Gameplay occupies the main area immediately; upgrades, records, collection and official chain readings are secondary screens.

The reusable interface is deliberately quieter than the game. Flat surfaces, thin borders, compact readable labels and a single bright action color keep the wheel and the sprint control prominent. Pixel type marks identity, headings and game counters; ordinary reading uses a proportional sans serif. These are implementation decisions inferred from the brief, rather than a separately approved brand system.

Primary sources: `src/styles.css`, `src/App.tsx`, the components in `src/components/`, and `src/game/MiningScene.ts`. Final rendered evidence is in `artifacts/desktop.png` and `artifacts/mobile.png`.

## Colors

All interface tokens live in `src/styles.css :root`. The site implements one dark theme.

| Token              | Value     | Implemented role                           |
| ------------------ | --------- | ------------------------------------------ |
| `--page`           | `#0b100e` | Page and quiet background                  |
| `--surface`        | `#121a15` | Cabinet, panels and dialog body            |
| `--surface-raised` | `#19231b` | Secondary layers and tracks                |
| `--surface-hover`  | `#223125` | Secondary action hover                     |
| `--line`           | `#2c3a2e` | Dividers and panel edges                   |
| `--line-strong`    | `#4e6346` | Outlined controls and stronger boundaries  |
| `--text`           | `#edf0e6` | Primary text                               |
| `--muted`          | `#a2ac9c` | Supporting text and quiet icons            |
| `--accent`         | `#a4ee74` | Primary action, selected navigation, Power |
| `--accent-hover`   | `#baf991` | Enabled primary action hover               |
| `--accent-dim`     | `#273d22` | Soft selected and combo surfaces           |
| `--accent-ink`     | `#15200f` | Text and icons on lime actions             |
| `--warning`        | `#efbd8b` | Recoverable errors and caution             |
| `--focus`          | `#d8ffa8` | Keyboard focus outline                     |

State meaning also uses text, icons, filled slots and disabled controls. Miss, Nice and Perfect are named explicitly. Wallet marks retain their original colors. The hamster palette and mine lighting are original art colors in `scripts/art.mjs` and `MiningScene.ts`, not additional interface accent tokens.

The final design probe passed its solid-text contrast checks. It excluded four text boxes over canvas/image/gradient backgrounds; no contrast ratio is claimed for those. See `artifacts/validation.md` for the scope of that measurement.

## Typography

Fonts are bundled locally in `public/assets/`, with `font-display: swap` and no synthetic weights:

- `--font-body`: **Space Grotesk, sans-serif**, 400 and 500, from `space-grotesk.woff2` and `space-grotesk-medium.woff2`. Body, controls, table content and explanatory copy.
- `--font-pixel`: **Silkscreen, monospace**, 400, from `silkscreen.woff2`. Wordmark, page titles, numeric HUD and key game feedback.

The six HTML type sizes are `--text-xs` 12px, `--text-sm` 14px, `--text-base` 16px, `--text-lg` 20px, `--text-xl` 28px and `--text-display` 40px, expressed in rem against a 16px root. There are no separate one-off HTML display sizes. Tiny canvas signage is part of the pixel-art scene and uses its world coordinate system.

Body line height is 1.5. Desktop h1 uses 40px / 1.2, weight 400 and −0.045em tracking. At 960px and below it uses 28px; phone heading tracking is −0.04em. H2 uses 20px / 1.35, weight 500; h3 uses 16px / 500. `.pixel` uses line height 1.3. Headings balance their wrapping, paragraphs use pretty wrapping, and changing counters use tabular numerals. Labels remain sentence case in source; Silkscreen supplies its arcade appearance.

## Layout

`main.main-shell` provides a 1440px maximum width including its padding. Normal desktop padding is 36px 40px 32px. The header is 88px high, with a separate maximum width of 1600px. Reuse these alignment edges across screens. Common spacing is 8, 12, 16, 20, 24, 28, 32 and 40px, with smaller gaps in dense controls; this is a convention in the stylesheet, not an additional spacing-token API.

The Play screen uses `.play-layout`: `minmax(0, 1fr) 288px`, with the scene/HUD/control cabinet in the fluid column and the current hamster, combo and instructions beside it. The scene is 410px high normally. Other screens reuse `.page-heading`, `.panel`, bordered rows and responsive grids rather than copying the Play sidebar.

| Breakpoint                      | Implemented change                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| At least 1550px                 | Scene 470px high; more vertical breathing room                                                                                             |
| At most 1190px                  | Outer gutters 28px; Play sidebar 250px; scene 390px                                                                                        |
| At most 960px                   | Navigation moves below header; Play stacks; scene 440px; collection becomes two columns                                                    |
| At most 600px                   | Header 70px; main gutters 16px; vertical icon navigation; scene 306px; large full-width sprint button; shop rows and chain sections reflow |
| At most 350px                   | Main gutters 12px; scene 285px; denser HUD and labels                                                                                      |
| Landscape, height at most 550px | Header 58px; compact navigation/heading; scene 270px; page can scroll normally                                                             |

The collection becomes one column on phones; official chain grids and account content stack. Long IDs wrap. Dialogs become bottom sheets on phones with safe-area bottom padding. The game viewport retains a positive canvas size while hidden and uses a resize observer to fit its visible host; its camera keeps the hamster and wheel centered. Only the game surface and sprint control suppress touch scrolling. The rest of the page scrolls normally.

All five screens were checked for horizontal overflow at 320, 390, 768, 960 and 1440px. At 390×844, the sprint button's bottom was measured at 774.59px, so the product, wheel and primary action are visible together. Other physical devices and native zoom remain unverified.

## Elevation & Depth

The interface uses tonal layers and 1px borders instead of card shadows. `.arcade-cabinet` groups the HUD, canvas and controls. Sidebar sections and record rows use dividers rather than nested panels. Canvas lighting, wheel highlights and sprite shadows belong to the game artwork.

`Modal` uses the native dialog top layer, a dark backdrop and 3px backdrop blur. The game loading/pause overlay sits within the scene; a single Resume action remains visible while paused. Keyboard focus uses a 2px `--focus` outline with 4px offset. The skip link appears above the header when focused.

## Shapes

Controls, inputs and most panels use 4px corners; the arcade cabinet uses 6px. Dialogs use 8px corners on desktop and 12px top corners as phone sheets. Small status/level segments use 3–5px corners. Status dots are circular. Scene objects and hamster sprites preserve hard pixel edges through `pixelArt`, disabled antialiasing and `image-rendering: pixelated`.

## Components

| Component / pattern         | Source and use                                | States and behavior                                                                                                             |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Primary / secondary actions | `src/styles.css`, `.primary`, `.secondary`    | Lime main action; outlined secondary action; explicit hover, focus and disabled states; minimum 46px height                     |
| Icon action                 | `.icon-button`, `Icon.tsx`                    | 40px square by default, accessible button names; compact variants appear in scene/header                                        |
| Navigation                  | `App.tsx`, `.desktop-nav`, `.mobile-nav`      | Hash links; `aria-current="page"`; selected underline plus color; keyboard accessible                                           |
| Game viewport               | `GameViewport.tsx`, `MiningScene.ts`          | Loading, load failure/reload, idle, active, Fever and paused states; pointer/touch and Space controls; optional sound           |
| HUD / charge meter          | `App.tsx`, `.hud`, `.charge-meter`            | Score, virtual Power and RPM; numeric progress semantics; wide Nice band, narrow Perfect band and live position marker          |
| Combo / feedback            | `App.tsx`, `.combo-panel`, `.game-feedback`   | Five slots, explicit combo number, Fever countdown and text outcome announcements                                               |
| Upgrade / collection        | `ProgressionViews.tsx`                        | Score prices, level caps and current/required virtual Power; upgrade buttons require both thresholds; owned cosmetics remain equippable                        |
| Leaderboard                 | `ProgressionViews.tsx`                        | Local/shared views; four metric buttons in a named group; loading, empty, unavailable and populated states                      |
| Official readings           | `ChainViews.tsx`, `lib/api.ts`                | Sepolia labels; loading/unavailable/stale/error text; integer-safe formatting; refresh skips endpoints until their own Retry-After deadline; same-ID lookups show loading and support retry |
| Wallet picker               | `ConnectWallet.tsx`, `lib/wallet.ts`          | Optional named browser wallets, mobile links, pending/errors, connected address, chain switching and disconnect                 |
| Modal                       | `Modal.tsx`                                   | Native `showModal()`, named heading, close button, Escape/backdrop dismissal, focus containment and return                      |
| Input / notice              | `.token-form input`, `.notice`, `.error-note` | Associated token lookup label, invalid input text, visible service/storage notices                                              |

Each upgrade row associates its Power requirement with its button through `aria-describedby`. The next tier requires 25 / 100 / 250 / 500 / 1,000 accumulated Power for levels 1–5, with Score as the only spendable currency. Current Power rounds down in eligibility copy so a fraction never displays as a reached threshold. Utility buttons retain native Space and Enter activation; the game intercepts Space only on gameplay targets outside dialogs.

Sound is opt-in. Backgrounding or leaving Play pauses gameplay and requires explicit resume. Reduced-motion preferences remove decorative wheel motion, idle looping, particles, shake and CSS transitions while preserving the essential playable trajectory. Forced-colors styles preserve focus and segmented control edges. These accommodations do not establish full screen-reader or physical-device accessibility certification.

## Do's and Don'ts

- Start another screen inside `.main-shell` with `.page-heading`, then reuse panels, rows, buttons and the six type tokens. Add a hash navigation entry in `App.tsx` when needed.
- Reserve lime fill for the action the player should take next. Use outlined or text actions for alternatives and `--warning` plus readable text for recoverable problems.
- Keep directions next to their controls. Preserve separate labels for virtual Power, game Score and official testnet readings.
- Keep sprites crisp and original. Reuse the generated sheets and frame map for animation rather than stretching a still portrait.
- Preserve keyboard focus, reduced motion, explicit pause and unavailable states when extending a component.
- Do not introduce additional fonts, unrelated accent ramps, gradient headings, shadowed nested cards or fabricated chain/leaderboard values. Keep deployment details in documentation rather than the main game flow.

The supplied Better Interface and design-documentation guidance informed this implementation. Attribution and licenses are retained in `artifacts/design-guidance-LICENSE.txt`.
