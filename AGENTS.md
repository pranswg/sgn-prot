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
`memberDirectory.test.ts`, `format.test.ts`. When you add a pure function worth
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

### 2. Fonts are self-hosted as `SuguanSheet`, not `Inter`

`src/assets/fonts/Inter-{Regular,Bold}.ttf` are registered in `src/index.css`
under the family name **`SuguanSheet`** and used by both the preview and the
PDF export. Do not rename the family to `Inter`. The app's own UI deliberately
uses a different font, and registering this file as `Inter` restyles the entire
application. The user prefers the preview font; keep both renderers on the same
files.

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
| `formationStore.ts` | `choir-formations` | 1 |
| `assignmentPresetStore.ts` | `choir-assignment-presets` | 1 |
| `navStore.ts` | not persisted | — |

`settingsStore` holds the three editable reference lists: service types, duty
roles, and voice positions. Each stored item carries `custom: boolean`; entries
without it came from constants and are labelled `(standard)` in the UI. If you
add a field, bump the store `version` and extend its `migrate`.

`navStore` is UI state only and is safe to change freely.

## Feature map

Six features under `src/features/`. Only the imports below cross feature
boundaries, so a change in one feature rarely reaches another.

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
  which is why `ListEditor.tsx` is generic over its field definitions.
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
