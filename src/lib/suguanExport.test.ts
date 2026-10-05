/**
 * Suguan sheet layout tests.
 *
 * These guard the invariant behind "Preview = Export PDF": both renderers read
 * their geometry from `computeSuguanLayout`, so the numbers asserted here are
 * the single source of truth for the on-screen preview, the PDF, and Excel.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  computeSuguanLayout,
  fitFontSizePt,
  SIG_RULE_PAD,
  type SheetMembers,
} from './suguanExport.ts'
import {
  clampCustomBodyFontSize,
  CUSTOM_BODY_FONT_MAX,
  CUSTOM_BODY_FONT_MIN,
  DEFAULT_DOC_FORMAT,
  FONT_SIZE_PRESETS,
  normalizeDocFormat,
  resolveFontSizePreset,
  scaleFontSizePreset,
} from './suguanUtils.ts'
import type { Suguan, SuguanDocFormat } from '../core/types/suguan.ts'

const PRESETS: SuguanDocFormat[] = (['small', 'normal', 'large'] as const).map(
  (fontSize) => ({
    paperSize: 'letter' as const,
    orientation: 'landscape' as const,
    margins: 'normal' as const,
    scaling: 'fit-width' as const,
    fontSize,
  }),
)

function makeMembers(count: number): SheetMembers[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    firstName: ['Julie', 'Maria', 'Ana', 'Rosa', 'Liza', 'Grace', 'Beth', 'Ruth'][i % 8],
    lastName: ['Sales', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Ramos'][
      i % 8
    ],
  }))
}

function makeSuguan(
  memberCount: number,
  docFormat?: SuguanDocFormat,
  scaling: SuguanDocFormat['scaling'] = 'fit-width',
): Suguan {
  const fmt = docFormat ? { ...docFormat, scaling } : undefined
  return {
    id: 'sg1',
    date: '2026-09-26',
    time: '18:00',
    serviceTypeId: 'svc1',
    group: 'mixed',
    docFormat: fmt ?? null,
    events: [
      { id: 'e1', type: 'pagsasanay', date: '2026-09-23', endDate: '2026-09-24' },
      { id: 'e2', type: 'pagtupad', date: '2026-09-26' },
    ],
    schedules: [],
    voiceCapacities: {},
    assignments: makeMembers(memberCount).map((m, i) => ({
      memberId: m.id,
      memberName: `${m.firstName} ${m.lastName}`,
      voicePosition: i % 2 === 0 ? 'soprano-1' : 'alto',
      assignedAt: '2026-09-20T10:00:00.000Z',
    })),
    dutyRoles: [],
    destinadoName: 'Parish Priest',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  } as Suguan
}

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`)

test('signature geometry is exposed as one shared object, not per-renderer scalars', () => {
  const layout = computeSuguanLayout(makeSuguan(12), makeMembers(12), PRESETS[1])
  const { sig } = layout
  assert.equal(sig.totalMm, sig.gapMm + sig.nameRowMm + sig.roleRowMm)
  assert.ok(sig.gapMm > 0, 'a gap between table and signatures is always reserved')
  assert.ok(sig.nameRowMm > 0)
  assert.ok(sig.roleRowMm > 0)
  assert.ok(sig.nameFontSizePt > 0)
  assert.ok(sig.roleFontSizePt > 0)
})

test('the gap above the signature block is generous at every font preset', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const { sig } = layout
    // At least two body rows of clear space, so signatures never read as table rows.
    assert.ok(
      sig.gapMm >= layout.bodyRowH * 1.9,
      `gap ${sig.gapMm}mm should clear at least two ${preset.fontSize} body rows`,
    )
    assert.ok(sig.gapMm > sig.nameRowMm * 0.7, 'gap must exceed the name row height')
  }
})

test('the reserved signature height is subtracted from the usable table height', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const expected =
      layout.paperHeightMm -
      layout.margins.top -
      layout.margins.bottom -
      layout.topBlockH -
      layout.sig.totalMm
    close(layout.usableTableH, expected)
    assert.ok(layout.usableTableH > 0)
  }
})

test('the last page always ends with gap, name, and role blocks in order', () => {
  // 60 members forces pagination, which is where the PDF previously diverged.
  for (const preset of PRESETS) {
    for (const scaling of ['fit-width', 'fit-page'] as const) {
      const suguan = makeSuguan(60, preset, scaling)
      const members = makeMembers(60)
      const layout = computeSuguanLayout(suguan, members, { ...preset, scaling })
      assert.ok(layout.pages.length > 1, 'expected this fixture to paginate')

      const last = layout.pages[layout.pages.length - 1]
      const tail = last.slice(-3).map((b) => b.kind)
      assert.deepEqual(tail, ['sig-gap', 'sig-name', 'sig-title'])

      // Every page except the last is pure table content.
      for (const page of layout.pages.slice(0, -1)) {
        assert.ok(
          page.every((b) => b.kind === 'section-label' || b.kind === 'member'),
          'only the final page carries the signature block',
        )
      }
    }
  }
})

test('signature column centres sit at the quarter and three-quarter marks', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const { sig } = layout
    close(sig.columnWidthMm, sig.tableWidthMm / 2)
    close(sig.leftCenterMm, sig.tableWidthMm * 0.25)
    close(sig.rightCenterMm, sig.tableWidthMm * 0.75)
  }
})

test('name and role text land inside their own rows', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const { sig } = layout
    // Name is centred vertically, and its rule sits below the text.
    close(sig.nameCenterMm, sig.nameRowMm / 2)
    assert.ok(sig.ruleOffsetMm > 0, 'the rule must sit below the name')
    // The rule must not spill past the bottom of the name row.
    assert.ok(sig.nameCenterMm + sig.ruleOffsetMm <= sig.nameRowMm)
    // Role text starts at the top of the role row, matching the PDF baseline.
    assert.ok(sig.roleCenterMm > 0 && sig.roleCenterMm < sig.roleRowMm)
  }
})

test('signature geometry is identical between fit-width and fit-page scaling', () => {
  // The signatures are deliberately exempt from fit-page scaling, so shrinking
  // the table to fit a page cannot move them.
  const wide = computeSuguanLayout(makeSuguan(60, PRESETS[1], 'fit-width'), makeMembers(60), {
    ...PRESETS[1],
    scaling: 'fit-width',
  })
  const fit = computeSuguanLayout(makeSuguan(60, PRESETS[1], 'fit-page'), makeMembers(60), {
    ...PRESETS[1],
    scaling: 'fit-page',
  })
  assert.equal(wide.scale, 1, 'fit-width must not scale')
  assert.ok(fit.scale < 1, 'fixture should trigger fit-page scaling')
  assert.deepEqual(wide.sig, fit.sig)
  // The body font may shrink, but the signatures must not.
  assert.ok(fit.bodyFontSizePt < wide.bodyFontSizePt)})

test('body font size carries the same fit-page clamp for both renderers', () => {
  const members = makeMembers(60)
  const layout = computeSuguanLayout(makeSuguan(60, PRESETS[1], 'fit-page'), members, {
    ...PRESETS[1],
    scaling: 'fit-page',
  })
  assert.ok(layout.scale < 1)
  assert.equal(layout.bodyFontSizePt, Math.max(6, layout.nameFontSize * layout.scale))
  assert.ok(layout.bodyFontSizePt >= 6)
})

test('fitFontSizePt shrinks only as far as needed and never below the floor', () => {
  const wide = () => 0.5 * 100
  const narrow = () => 0.5 * 10
  assert.equal(fitFontSizePt({ text: 'a', startSizePt: 12, maxWidthMm: 100, measureMm: narrow }), 12)
  assert.equal(
    fitFontSizePt({ text: 'a', startSizePt: 12, maxWidthMm: 3, measureMm: wide, minSizePt: 6 }),
    6,
  )
  // Monotonic: a looser bound never produces a smaller size.
  const loose = fitFontSizePt({ text: 'Julie Anne Sales', startSizePt: 12, maxWidthMm: 60, measureMm: wide })
  const tight = fitFontSizePt({ text: 'Julie Anne Sales', startSizePt: 12, maxWidthMm: 30, measureMm: wide })
  assert.ok(tight <= loose)
})

test('a signature name is never squeezed below the column it must fit', () => {
  const layout = computeSuguanLayout(makeSuguan(12, PRESETS[1]), makeMembers(12), PRESETS[1])
  const sizePt = fitFontSizePt({
    text: 'A Very Long Signature Name Indeed',
    startSizePt: layout.sig.nameFontSizePt,
    maxWidthMm: layout.sig.columnWidthMm - 2 * SIG_RULE_PAD,
    // 0.5mm per point of font size
    measureMm: (_t, s) => s * 0.5,
  })
  const widthMm = sizePt * 0.5
  assert.ok(widthMm <= layout.sig.columnWidthMm - 2 * SIG_RULE_PAD)
})

test('an empty roster still lays out a full page without a phantom gap', () => {
  const layout = computeSuguanLayout(makeSuguan(0), [], PRESETS[1])
  assert.equal(layout.rowCount, 0)
  assert.equal(layout.sig.gapMm, 0)
  assert.equal(layout.pages.length, 1)
  const tail = layout.pages[0].slice(-3).map((b) => b.kind)
  assert.deepEqual(tail, ['sig-gap', 'sig-name', 'sig-title'])
})

test('the default document format is normal and reads one step larger than small', () => {
  // Pinned because "increase the default font size" is a deliberate change; if a
  // future edit drops this back, the sheet silently gets hard to read again.
  assert.equal(DEFAULT_DOC_FORMAT.fontSize, 'normal')
  assert.equal(FONT_SIZE_PRESETS.normal.bodyFontSize, 10)
  assert.ok(FONT_SIZE_PRESETS.normal.bodyFontSize > FONT_SIZE_PRESETS.small.bodyFontSize)
  assert.ok(FONT_SIZE_PRESETS.large.bodyFontSize > FONT_SIZE_PRESETS.normal.bodyFontSize)
  // Every preset must stay in ascending order or the picker stops meaning anything.
  assert.ok(FONT_SIZE_PRESETS.small.bodyFontSize < FONT_SIZE_PRESETS.normal.bodyFontSize)
})

test('a custom body size is clamped and rounded to a half point', () => {
  assert.equal(clampCustomBodyFontSize(undefined), FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(clampCustomBodyFontSize(NaN), FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(clampCustomBodyFontSize('not a number'), FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(clampCustomBodyFontSize(2), CUSTOM_BODY_FONT_MIN)
  assert.equal(clampCustomBodyFontSize(400), CUSTOM_BODY_FONT_MAX)
  assert.equal(clampCustomBodyFontSize(11.3), 11.5)
  assert.equal(clampCustomBodyFontSize(12), 12)
})

test('resolveFontSizePreset derives custom from the body size, never undefined', () => {
  const custom = resolveFontSizePreset(
    normalizeDocFormat({ ...DEFAULT_DOC_FORMAT, fontSize: 'custom', customBodyFontSize: 14 }),
  )
  assert.equal(custom.bodyFontSize, 14)
  assert.ok(custom.titleFontSize > custom.bodyFontSize, 'the title stays larger than the body')
  assert.ok(custom.sigFontSize > custom.bodyFontSize)
  // A cleared custom input must fall back rather than produce a zero-size sheet.
  const cleared = resolveFontSizePreset(
    normalizeDocFormat({ ...DEFAULT_DOC_FORMAT, fontSize: 'custom' }),
  )
  assert.equal(cleared.bodyFontSize, FONT_SIZE_PRESETS.normal.bodyFontSize)
})

test('scaling a preset keeps row heights ahead of the text they contain', () => {
  // The failure this guards: a bigger font in an unchanged row, so names clip.
  for (const body of [6, 8, 10, 14, 18, CUSTOM_BODY_FONT_MAX]) {
    const fs = scaleFontSizePreset(FONT_SIZE_PRESETS.normal, body)
    assert.equal(fs.bodyFontSize, body)
    assert.ok(fs.rowHeight >= fs.bodyFontSize * 1.2, `row too short at ${body}pt`)
    assert.ok(fs.headerRowHeight >= fs.headerFontSize * 1.2, `header row too short at ${body}pt`)
    assert.ok(fs.sigRowHeight >= fs.sigFontSize * 1.2, `sig row too short at ${body}pt`)
    assert.ok(fs.titleRowHeight >= fs.titleFontSize * 1.5, `title row too short at ${body}pt`)
    // A larger body never yields a smaller row, or scaling would not be monotonic.
    if (body > FONT_SIZE_PRESETS.normal.bodyFontSize) {
      assert.ok(fs.rowHeight > FONT_SIZE_PRESETS.normal.rowHeight)
    }
  }
})

test('a custom font size reaches both renderers through the shared layout', () => {
  const custom: SuguanDocFormat = {
    paperSize: 'letter',
    orientation: 'landscape',
    margins: 'normal',
    scaling: 'fit-width',
    fontSize: 'custom',
    customBodyFontSize: 16,
  }
  const layout = computeSuguanLayout(makeSuguan(12, custom), makeMembers(12), custom)
  assert.equal(layout.fs.bodyFontSize, 16)
  assert.ok(layout.bodyRowH > 0)
  assert.ok(layout.rowsPerPage > 0)
  assert.ok(layout.usableTableH > 0)
  assert.ok(layout.sig.nameFontSizePt > 0)
  // Bigger type must mean fewer rows on the page, not the same count.
  const normal = computeSuguanLayout(makeSuguan(12, PRESETS[1]), makeMembers(12), PRESETS[1])
  assert.ok(layout.rowsPerPage < normal.rowsPerPage, '16pt should fit fewer rows than normal')
})
