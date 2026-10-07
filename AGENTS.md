# AGENTS.md

Working notes for AI agents and humans editing this repository. Everything here
is either a rule that **cannot be inferred from the code**, or a map that saves
navigation time. If a rule below is unclear, ask rather than guess.

## Commands

```bash
npm run verify              # typecheck + tests + lint, run this
npm run typecheck           # tsc -b, ~5s warm
npm test                    # node:test, ~0.6s
npm run lint                # oxlint, ~0.5s
npm run build               # tsc -b + vite build
```

`npm run verify` is the gate: all of it must exit clean before a change is done.
The whole cycle is about six seconds, so re-run it after every edit rather than
batching checks at the end. Do **not** run `npm run dev`; there is no
interactive terminal here.

Tests use `node:test` with the glob `src/**/*.test.ts`, loaded through
`scripts/test-aliases.mjs`, which teaches Node to resolve the `@/` alias and
extensionless relative imports. Two consequences:

- Tests must stay in plain `.test.ts` files with **no JSX**, because the runner
  has no DOM.
- Import with an explicit extension (`./phDate.ts`) or a `@/` alias. A bare
  extensionless relative path will not resolve from a test file.

Test files that exist, all pure-logic: `suguanDates.test.ts`,
`suguanExport.test.ts`, `spreadsheetImport.test.ts`, `rosterImport.test.ts`,
`memberDirectory.test.ts`, `format.test.ts`, `credentials.test.ts`,
`sidebarNav.test.ts`, `reorderList.test.ts`, `navStore.test.ts`, and
`features/settings/referenceList.test.ts`. When you add a pure function worth
protecting, add cases next to it rather than leaving behaviour implicit.

`tsconfig.app.json` enables `noUnusedLocals` and `noUnusedParameters`, so a
typecheck failure about an unused import is usually a real leftover from an edit
rather than noise. Keep these enabled.

## The two rules that matter most

### 1. The PDF must match the preview exactly

`src/features/suguan-builder/SuguanSheetPage.tsx` (preview, DOM) and
`src/features/suguan-builder/suguanPdfExport.tsx` (PDF, jsPDF) render the same
printed sheet and **must produce identical output**. The preview is the source
of truth for layout. Never add a PDF-only offset, nudge, or spacing constant to
make the PDF line up.

All shared geometry lives in `src/lib/suguanExport.ts`:
`SignatureGeometry`, `computeSuguanLayout`, `buildSections`,
`computeNameLayout`, `fitFontSizePt`, `PT_TO_MM`, and the `SIG_*` constants.
Excel output in the same file consumes the same geometry. If you need a new
layout value, add it there and consume it in both renderers, then add a
regression test to `src/lib/suguanExport.test.ts`.

This rule exists because a real bug shipped: the PDF renderer was missing a
`sig-gap` branch that the preview had, so signatures rode up over the table
while the preview looked correct. Signature gap is `SIG_GAP_ROWS = 2.5` and
signatures are never scaled under fit-page mode.

**Never index `FONT_SIZE_PRESETS[fmt.fontSize]`.** `DocFontSize` includes
`custom`, which has no static preset, so that index is a lie the type system
only catches because the record is keyed `Exclude<DocFontSize, 'custom'>`.
Call `resolveFontSizePreset(fmt)` instead — it returns the static preset or
derives one from `customBodyFontSize`. `SuguanSheetPage` reads `layout.fs`,
so preview, PDF, and Excel all share whichever preset that returns; adding a
fourth renderer must do the same rather than re-reading the preset itself.

`scaleFontSizePreset` scales the whole `normal` preset by one factor instead of
exposing eight independent inputs, because the preset's font sizes, row heights,
and column weights only look right in proportion to each other. A custom size
must keep that coupling or names start clipping their rows. The custom body size
is clamped to `CUSTOM_BODY_FONT_MIN..MAX` and rounded to a half point in
`normalizeDocFormat`, so a cleared or garbage input falls back to `normal`
rather than reaching the layout maths as `NaN`.

### 2. Fonts are self-hosted as `SuguanSheet`, not `Inter`

`src/assets/fonts/Inter-{Regular,Bold}.ttf` are registered in `src/index.css`
under the family name **`SuguanSheet`** and used by both the preview and the
PDF export. Do not rename the family to `Inter`. The app's own UI deliberately
uses a different font, and registering this file as `Inter` restyles the entire
application. The user prefers the preview font; keep both renderers on the same
files.

The Organist Suguan PDF keeps a second bundled font:
`src/assets/fonts/SegoeScript.ttf` is a copy of the Windows system font,
imported as a URL and base64-fed into jsPDF (`addFileToVFS` + `addFont` +
`setFont`) so the "SUGUAN NG MGA ORGANISTA" heading is real vector text, not a
canvas raster. Do not revert it to a times/helvetica heading; the user insisted
the Segoe Script look stays. It fails closed to `times` bold if the asset
cannot be fetched.

## Dates and time zones

Canonical calendar dates are **`YYYY-MM-DD` strings**, never `Date` objects.
Helpers live in `src/lib/phDate.ts`; worship-block planning is in
`src/lib/suguanDates.ts`.

- All display and "now" logic is pinned to `Asia/Manila` (`PHT_TIME_ZONE`).
  Convert an instant with `toDateKeyFromInstant`, and get today with `todayPHT()`.
- Never write `new Date('2024-01-05')`. It parses as UTC midnight, so in PHT it
  becomes the previous day.
- Never use local `getDay()` or `getDate()` for choir calendar math.
- Never derive a date via `toISOString().slice(0, 10)`; that converts through
  UTC and shifts the day.
- Use `isDateKey()` to decide whether a date is usable before doing math on it.
  A blank Suguan date is a normal state, not a bug to paper over.

Date and layout logic is covered by `src/lib/suguanDates.test.ts` and
`src/lib/suguanExport.test.ts`. If you touch date behaviour, add cases there.

### Domain rules

- **A new Suguan has no dates.** `defaultCoverage()` returns
  `startDate: ''`, and `planEventsFromCoverage` returns `[]` for a blank date
  rather than falling back to `todayPHT()`. Every printed date must be one the
  user chose. Never reintroduce a clock-based default here; if you need "now"
  for a live preview, ask first.
- **Pagsasanay** is exactly what the user entered. Never derive or adjust it.
- **Pagtupad** is derived from the worship schedule, either
  Wednesday–Thursday or Saturday–Sunday. See
  `src/core/constants/worshipSchedules.ts`.
- `date-fns` is installed but unused. Leave it alone; do not remove it and do
  not start using it.

## Where state lives

Zustand stores in `src/store/`, each persisted to `localStorage` with a
migration function. **UI-only changes must not change a persisted shape.**

| Store | localStorage key | version |
| --- | --- | --- |
| `memberStore.ts` | `choir-members` | 3 |
| `suguanStore.ts` | `choir-suguan` | 6 |
| `settingsStore.ts` | `choir-settings` | 3 |
| `assignmentPresetStore.ts` | `choir-assignment-presets` | 1 |
| `authStore.ts` | `choir-auth` | 1 |
| `sidebarStore.ts` | `sidebarExpanded` | 1 |
| `navStore.ts` | not persisted | — |

**The repo must stay data-free.** Everything the user types — locale congregation
name, worship schedules, service types, members, Suguan records, accounts —
lives only in the browser's `localStorage`; none of it is ever written to a file
in this repository. Pushing code never ships their input. The only user-account
artefact that travels is the `fr` seed *logic* in `authStore.ts`, which
re-creates the default `fr / 12345678` account in each fresh browser — that
runtime seed is the lone exception and must remain. If a store or feature ever
needs to persist user input to disk (a data file, an export written into the
project, a local DB), stop and ask first: it would violate this rule. Drops and
accidental files from Settings' backup/export belong in `.gitignore`, not in a
commit.

`settingsStore` holds the three editable reference lists: service types, duty
roles, and voice positions. Each stored item carries `custom: boolean`; entries
without it came from constants and are labelled `(standard)` in the UI. If you
add a field, bump the store `version` and extend its `migrate`.

`navStore` is UI state only and is not persisted, but it is **not** free to
change. There is no router, so `page` is the entire navigation model, and the
"start a new Suguan" dialog depends on it:

- Entering the builder swaps `page` immediately, which mounts the builder
  *behind* the dialog. `builderReturnPage` records the page the user was on so
  dismissing the dialog can send them back. Without it, clicking the backdrop
  leaves them on an empty step 0 with no way home except the close button.
- **Every** entry point must arm that origin, not just `startNewSuguan`. The
  sidebar, mobile bottom nav, and breadcrumb all go through `navigate`, so
  `navigate` records it too. Adding a fourth entry point means updating both.
- Arm it only when `page !== 'suguan-builder'` already, or "start over" from
  inside the builder would record a self-return.
- `dismissNewSuguan` and `onStartNew`/`onCopy` must both clear it. Left armed, it
  fires later and yanks the user away from a builder they are working in.
- `editSuguanInBuilder` deliberately leaves it `null`: editing a saved Suguan
  opens no dialog, so there is nothing to dismiss.

`StartModeDialog` receives the whole `suguan` list just to populate its copy
list, and it is not keyed by page, so `SuguanBuilderPage` resets `startOpen`
from `existing` rather than remembering that the user already chose.

Most persisted stores implement `importData()` so Settings' backup/restore can
round-trip them. **`authStore` deliberately does not** — accounts are excluded
from the backup file, because restoring a JSON file should never install someone
else's password hashes on this machine. Do not add `importData` to it later
without asking.

## The sidebar is a floating card, split across `components/sidebar/`

`src/components/ui/sidebar.tsx` was deleted. Its state model (`collapsible =
"offcanvas" | "icon" | "none"`, a `document.cookie` flag, a hover rail, an
`inset` variant) does not match how this app collapses, and leaving a second
competing sidebar primitive in `ui/` invites reintroducing it. Do not re-add it.

The sidebar is composed from `src/components/sidebar/`, not one file:
`SidebarShell` (the card), `SidebarBody` (the shared scroll region), and
`SidebarHeader`, `SidebarSection`, `SidebarItem`, `ThemeToggle`,
`SidebarFooter`, `OrganizationCard`.
`src/components/AppSidebar.tsx` is only the desktop-or-drawer switch.

There is deliberately **no sidebar search**. `SidebarSearch` and the
`filterNavItems` / `filteredNavGroups` helpers were removed: the member
directory already owns search and filters in `MasterListPage`, and a second
global search in the nav was a shortcut to the same pages rather than a
distinct feature. Do not reintroduce one without asking.

**`SidebarBody` is the reason the two layouts agree.** Desktop and mobile render
the same body with a different `collapsed` value, so a change to nav or the
search box lands in both. Do not fork the two.

Two independent states, deliberately:

| State | Width | Persisted |
| --- | --- | --- |
| `isNavigationOpen` | 0 when false, else below | no — defaults to `window.innerWidth >= 768` |
| `isSidebarExpanded` | 72px collapsed, 260px expanded | yes, `localStorage.sidebarExpanded` |

Geometry lives in `SIDEBAR_WIDTH` / `SIDEBAR_METRICS` in
`src/lib/sidebarNav.ts`, and `sidebarNav.test.ts` pins it.

Rules that are easy to break:

- **The width animation is CSS only.** `transition-all duration-300 ease-in-out`
  on the card. Do not add a JS tween.
- **The 16px outer inset lives on the `Layout` wrapper (`flex gap-4 p-4`), not on
  the sidebar.** The card and the content therefore share one gutter, and
  `<main>` stays a full-bleed page with no rounding, border, or shadow. Do not
  add a margin to `main` as well; two insets is what made this look cramped.
  The panel is full-height and full-bleed with a right divider, still in normal
  flow so it pushes content — there is no desktop overlay. Mobile is the only
  overlay, a Radix `Sheet`. It has **no margin, no gutter, no rounded corners, and
  no drop shadow**. Insetting it and rounding the corners turns the sidebar into
  a small detached panel floating inside the app, which is the one look to avoid;
  `Layout` uses a plain `flex` row with no `gap` or `padding` for the same reason.
  Do not reintroduce a floating card here.
- **`dvh`, not `vh`, on the card height.** A `100vh` card overflows once a mobile
  URL bar or desktop zoom shrinks the visible viewport.
- **Internal insets are per element, never nested.** `SidebarBody` has no
  horizontal padding; the header uses `px-5`, `SidebarSection` uses `px-1` on
  its rows, and the footer and org card use `px-1`. Adding padding to the body
  as well stacks insets and undoes the breathing room.
- **The active pill stops 4px short of the card edge** because
  `SidebarSection` insets its rows by `px-1`, not because the button is narrower.
- **The nav row is a fixed 44px in both states** (`grid h-11 place-items-center`
  wrapping a 38px expanded pill or a 44px collapsed tile). If the row itself
  resizes, every item below shifts by 6px during the collapse and the list
  visibly shuffles. `SIDEBAR_METRICS` is tested for exactly this.
- **Labels fade with `max-w-0` + `opacity-0`, not unmounting**, and every one
  needs `overflow-hidden` or it still reserves width while invisible. Section
  headings animate `grid-template-rows` `1fr`→`0fr` so rows below slide rather
  than snap.
- **A click on the collapsed rail expands first, then navigates** (`SidebarItem`).
  Navigating without the label on screen leaves the user unable to tell where
  they landed. The collapsed search button expands for the same reason.
- **Tooltips are collapsed-only with a 600ms `delayDuration`.** Shorter and they
  flash while the pointer crosses the list.
- The hidden card is `inert`, not just `w-0`. A zero-width clipped aside is still
  in the tab order and the accessibility tree.
- Timings are load-bearing: 300ms for width and labels, 150ms for item hover,
  600ms for tooltip delay. `motion-reduce:transition-none` is on every animated
  element.

`sidebarNav.test.ts` asserts that every `Page` has exactly one nav entry, so
adding a page without a nav item fails the build rather than silently dropping
the row.

`src/components/ui/sheet.tsx` grew an `overlayClassName` prop so a caller can
match the overlay fade to the panel slide. The nav drawer uses it for 300ms.

## Theming is `next-themes`, and it toggles the whole app

`next-themes` was already a dependency and `ui/sonner.tsx` already called
`useTheme()`, but **no provider was ever mounted**, so that call was reading a
default-constructed context. `src/components/sidebar/ThemeProvider.tsx` is now
mounted in `App.tsx` and wraps everything, including `AuthPage`.

Three decisions are fixed there, so do not repeat them at call sites:

- `attribute="class"` toggles `.dark` on `<html>`, which is what
  `@custom-variant dark (&:where(.dark, .dark *))` in `index.css` matches.
- `defaultTheme="system"` plus `enableSystem` is what makes the first load follow
  the OS. An explicit choice is stored and wins afterwards. **Do not hand-roll a
  second theme store or read `localStorage.theme` directly.**
- `storageKey="choir-theme"` matches the `choir-` prefix. next-themes would
  otherwise claim the bare `theme` key.

`ThemeToggle` reads `resolvedTheme`, not `theme`. `theme` returns the literal
string `"system"` on a machine where the user never chose, and there is no sun
glyph for that; `resolvedTheme` is the one that is actually applied.

**The toggle is app-wide, not sidebar-only.** Every `.dark` block in
`index.css` already existed, so this mainly means previously unreachable dark
tokens are now reachable. If you restyle the sidebar, check it in both themes —
a token defined only under `:root` silently becomes light-on-light in dark mode.

The sidebar has its own neutral scale rather than reusing `--background`:
`--sidebar`, `--sidebar-foreground`, `--sidebar-secondary`, `--sidebar-muted`,
`--sidebar-border`, `--sidebar-hover`, `--sidebar-active`,
`--sidebar-search`, `--sidebar-org`, `--sidebar-org-border`, plus
`--app-background` for the backdrop behind the card. Shadows are
`--shadow-sidebar-card` and `--shadow-nav-active`, consumed as
`shadow-[var(--shadow-…)]` so one token switches value per theme.

`--brand-gold` is a brand highlight only, currently the rule under the wordmark.
It must never colour a nav row, a button, or a state.

## Sign-in is local, and that is a deliberate limitation

`App.tsx` renders `features/auth/AuthPage.tsx` instead of `Layout` until
`authStore.currentAccountId` is set. Login and registration live on one screen
because there is no router in this app; the mode is local state.

**There is no server.** Accounts live in `localStorage` under `choir-auth`, and a
password is stored only as a PBKDF2-SHA256 digest (210k iterations) plus a
per-account salt. On insecure origins (a phone hitting the dev server over
plain http, where `crypto.subtle` does not exist) hashing falls back to an
iterated pure-JS SHA-256 KDF instead of throwing; the account records which
`hashAlgo` produced it and verification must use the same one. That keeps
plaintext out of the backup file. It is not
security: anyone with devtools can read the store, or overwrite it to sign in as
anyone. Do not describe this to the user as protecting their data, and do not
build features that assume it does — there is no real authorisation anywhere.

Rules if you touch it:

- Keep rules in `src/lib/credentials.ts`, not in the component. The page renders
  `FieldProblem[]` returned by `validateRegistration`; it must not re-check a
  rule locally or the two will drift.
- Never log, toast, or render a password or hash. `AuthPage` deliberately has no
  password in any error message.
- `signIn` returns the same message for an unknown username and a wrong
  password, and hashes anyway in the unknown-username case so the two take
  similar time. Do not "helpfully" split those cases.
- `roleForNewAccount` grants `admin` to the first registration only because a
  fresh install needs someone to see that an admin exists. It is not an
  authorisation check.
- `authStore` seeds a default account (`fr` / `12345678`) whenever that
  username is missing, and signs in as it only when nobody is signed in
  already. The credentials intentionally fail `validateRegistration`
  (two-character username, all-digit password) — the seed creates the account
  directly, so do not route it through the form rules.

## Feature map

Seven features under `src/features/`. Only the imports below cross feature
boundaries, so a change in one feature rarely reaches another.

- **auth** — `AuthPage.tsx`, the pre-shell sign-in and registration screen.
  Bypasses `Layout` entirely; see the sign-in section above.
- **dashboard** — `DashboardPage.tsx`, read-only summaries.
- **master-list** — members and trainees. The largest feature. Directory table
  and grid, mobile sheets, roster import, and CSV/Excel export.
  `MasterListPage.tsx` owns the filters; child components receive
  `members`, `references`, and `sort` as props.
- **suguan-builder** — the multi-step Suguan sheet. Steps are defined in
  `builderState.ts` (`BUILDER_STEPS`). The pipeline is
  `CoverageStep` → `DocumentSetupStep` → `SchedulesStep` →
  `AssignmentWorkspace` → `PreviewStep`.
- **suguan-history** — saved Suguan list and detail view.
- **trainees** — trainee-only forms.
- **settings** — reference list management, backup export/import.

`src/features/suguan-builder/builderState.ts` is the pattern to copy: draft
state, pure transforms, and step metadata with no React inside. Prefer adding
pure functions there over growing a step component.

## Roster import and export

`src/lib/export.ts` writes the CSV and XLSX files. `src/lib/rosterImport.ts`
reads the roster PDF. `src/lib/spreadsheetImport.ts` reads the CSV and Excel
files that `export.ts` produces, so the Import Roster dialog round-trips an
export. When you change one side, change the other:

- Export headers are `MEMBER_EXPORT_HEADERS` / `TRAINEE_EXPORT_HEADERS`.
  A trainee export has no Membership Type or Positions column, and that absence
  is how the importer detects trainee sheets. Preserve it.
- `positionSummary` writes labels joined with `", "`, using `—` for none.
  `resolvePositions` in `spreadsheetImport.ts` is the inverse.
- The importer is deliberately forgiving of hand-edits: headers match on a
  normalised key, title rows above the header are skipped, voice sections
  resolve by id, full name, or short name, and unreadable values fall back
  rather than dropping the row. Keep it that way.

## Conventions

- Path alias is `@/` for `src/`. No relative imports that climb out of a folder.
- Match the surrounding file's style. The codebase uses no semicolons, single
  quotes, and two-space indent.
- Prefer a data-driven render over a hardcoded block when a list already exists,
  which is why `SettingsList.tsx` takes a `ReferenceField[]` and renders all
  three reference lists from one component (it replaced `ListEditor.tsx`).
  A list also carries its own validation: `referenceProblem` in
  `settingsList.ts` decides whether a save is legal, on both breakpoints.
- UI primitives are shadcn-style components in `src/components/ui/`. Add to
  them rather than hand-rolling a new primitive, and reuse
  `Popover` + `Command` for anything searchable. `tw-animate-css` supplies the
  animations.
- Never nest a Radix `Select` portal inside another portal; use a text field or
  a segmented toggle.
- Icons come from `lucide-react`. There is also a stray `cn` package in
  `dependencies`; the app uses `@/lib/utils` and ignores it.
- Do not add dependencies without asking.

## Things that will bite you

- `AssignmentWorkspace.tsx` is 1075 lines and holds five inline components
  (`PanelShell`, `EmptyState`, `VoiceGroupHeader`, `MemberAvatar`,
  `AssignmentRow`), but only 6 `useState` calls and a four-field props
  interface. `MasterListPage.tsx` is 736 lines with 3 `useState` calls and takes
  no props. These files are long because logic is colocated, not because props
  sprawl. Touching one means reading the whole file; extract rather than append.
  Re-measure before quoting these numbers again; they drift as code changes.
- `src/core/types/suguan.ts` is imported by 36 files and
  `core/types/member.ts` by 30. A change to either is a wide change. Prefer
  adding optional fields to a type over changing an existing one.
- `settingsStore` is imported by 24 files across features. Changing what a
  stored item means affects the builder's schedule step, not just Settings.
- `SuguanSheetPage.tsx` and `suguanPdfExport.tsx` each switch over block kinds.
  Keep those switches exhaustive with a `never` guard, so a new block kind fails
  typecheck instead of rendering nothing.
- `npm run lint` emits about eight pre-existing `react(only-export-components)`
  and `react(set-state-in-effect)` warnings, mostly in `src/components/ui/*` and
  the three form dialogs. They are not regressions. Do not chase them, and do
  not let one hide a real error behind it.

## Known limitations worth knowing before you "fix" them

These are pinned by tests that assert current behaviour. Change the code only if
you also update the test, and only if the user asked for the change.

- **Roster PDF: leader rows with a banned role marker are dropped.**
  `looksLikeName` rejects any line containing a `BANNED_NAME_TOKENS` entry, and
  ten of the eleven `ROLE_MARKERS` are in that set (`PANGULONG`, `ORGANISTA`,
  `LEAD`, `OIC`, `PNK`, `TSV`, `ATPA`, `MANG-AAWIT`, `KATUWANG`, `NAGBABALIK`).
  The check runs before `stripRoleSuffix`, so a leader line such as
  `Dela Cruz, Juan PANGULONG` loses the whole row instead of importing with the
  role in notes. Only `KALIHIM` currently survives. The fix is to let the
  `leaders` and `organista` sections bypass the banned-token check, since there
  a trailing uppercase word is known to be a role.
  See `src/lib/rosterImport.test.ts`.
- **Roster PDF: middle-name initials are stripped.** A single-letter token in a
  row is treated as a stray role-column marker and removed, so `Lyka D.` imports
  as `Lyka`.
- **`normalizeNameKey` does not normalise interior whitespace**, because
  `.trim()` runs once on the joined `last|first` string. Currently latent: name
  splitting filters empty tokens first.
- **Roster notes flatten punctuation.** `cleanNote` turns hyphens and en/em
  dashes into spaces, so `BALIK-TUNGKULIN` is stored as `Balik Tungkulin`.
- **Excel import reads only the first worksheet.** There is no sheet picker.
